import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import type { Manifest } from '../../tools/oracle/callgraph/status';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const DISPATCH_PATH = path.join(REPO_ROOT, 'tools', 'oracle', 'callgraph', 'dispatch-tables-113c.json');
const MANIFEST_PATH = path.join(REPO_ROOT, 'tools', 'oracle', 'callgraph', 'manifest-113c.json');
const D2_DATA_DIR = process.env.D2_DATA_DIR || path.join(os.homedir(), 'd2-data');

interface DispatchTablesConfig {
  version: string;
  modules: Record<
    'D2Game' | 'D2Common',
    {
      imageBase: string;
      text: { start: string; end: string };
      rdata: { start: string; end: string };
      data: { start: string; end: string };
    }
  >;
  rootEntryPoints: Array<{ va: string; name: string; module: 'D2Game' | 'D2Common'; description: string }>;
  dispatchTables: Array<{
    name: string;
    description: string;
    module: 'D2Game' | 'D2Common';
    baseAddress: string;
    type?: string;
    stride?: number;
    count?: number;
    pointerOffsets?: number[];
    evidence?: string;
    entries?: Array<{ index: number; va: string; name: string; evidence: string }>;
  }>;
  pruned_roots_and_funcs: {
    prunedDataTables?: Array<{
      module: 'D2Game' | 'D2Common';
      baseAddress: string;
      stride: number;
      count: number;
      reason: string;
      evidence: string;
    }>;
    prunedCallSiteRanges: Array<{
      module: 'D2Game' | 'D2Common';
      start: string;
      end: string;
      containingFn: string;
      reason: string;
      evidence: string;
    }>;
    prunedCodeRanges: Array<{
      module: 'D2Game' | 'D2Common';
      start: string;
      end: string;
      category: string;
      reason: string;
      evidence: string;
    }>;
    prunedFunctions: Array<{
      va: string;
      module: 'D2Game' | 'D2Common';
      name: string;
      reason: string;
      evidence: string;
    }>;
  };
}

const dispatchCfg: DispatchTablesConfig = JSON.parse(fs.readFileSync(DISPATCH_PATH, 'utf-8'));
const manifest: Manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));

function nodeKey(mod: string, vaHexOrInt: string | number): string {
  const vaNum = typeof vaHexOrInt === 'number' ? vaHexOrInt : parseInt(vaHexOrInt, 16);
  return `${mod}:${vaNum.toString(16).toUpperCase().padStart(8, '0')}`;
}

function collectFilesRecursive(dir: string, exts: ReadonlySet<string>): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...collectFilesRecursive(full, exts));
    } else if (exts.has(path.extname(ent.name).toLowerCase())) {
      out.push(full);
    }
  }
  return out.sort();
}

interface LoadedPeInfo {
  buf: Buffer;
  base: number;
  textStart: number;
  textEnd: number;
  textRawPtr: number;
  vaToFileOffset: (va: number) => number;
}

function loadPeModule(dllPath: string, expectedBase: number): LoadedPeInfo {
  const buf = fs.readFileSync(dllPath);
  const e_lfanew = buf.readUInt32LE(0x3c);
  const numSec = buf.readUInt16LE(e_lfanew + 6);
  const optSize = buf.readUInt16LE(e_lfanew + 20);
  const imageBase = buf.readUInt32LE(e_lfanew + 24 + 28);
  expect(imageBase).toBe(expectedBase);

  const secTable = e_lfanew + 24 + optSize;
  const sections: Array<{ vaddr: number; vsize: number; rawPtr: number; rawSize: number }> = [];
  for (let i = 0; i < numSec; i++) {
    const sh = secTable + i * 40;
    const vsize = buf.readUInt32LE(sh + 8);
    const vaddr = buf.readUInt32LE(sh + 12);
    const rawSize = buf.readUInt32LE(sh + 16);
    const rawPtr = buf.readUInt32LE(sh + 20);
    sections.push({ vaddr, vsize, rawPtr, rawSize });
  }
  const textSec = sections[0]!;
  return {
    buf,
    base: imageBase,
    textStart: imageBase + textSec.vaddr,
    textEnd: imageBase + textSec.vaddr + textSec.vsize,
    textRawPtr: textSec.rawPtr,
    vaToFileOffset(va: number): number {
      const rva = va - imageBase;
      for (const s of sections) {
        const span = Math.max(s.vsize, s.rawSize);
        if (rva >= s.vaddr && rva < s.vaddr + span) {
          return s.rawPtr + (rva - s.vaddr);
        }
      }
      throw new Error(`VA 0x${va.toString(16)} outside PE sections in ${dllPath}`);
    },
  };
}

describe('Diablo II v1.13c Kernel Call Graph & Manifest ([K0] Track A)', () => {
  const fnByKey = new Map(manifest.functions.map(fn => [nodeKey(fn.module, fn.va), fn]));

  it('validates manifest-113c.json schema, summary counts, ready splits, and bidirectional edge symmetry', () => {
    expect(manifest.version).toBe('1.13c');
    expect(manifest.summary.totalReachable).toBe(manifest.functions.length);
    expect(manifest.summary.totalReachable).toBe(4810);
    expect(manifest.summary.d2GameReachable).toBe(3331);
    expect(manifest.summary.d2CommonReachable).toBe(1479);
    expect(manifest.summary.sccCount).toBe(4626);
    expect(manifest.summary.d2GameReachable + manifest.summary.d2CommonReachable).toBe(
      manifest.summary.totalReachable
    );

    expect(manifest.summary.outsideClosureD2GameCount).toBe(721);
    expect(manifest.summary.outsideClosureD2CommonCount).toBe(880);
    expect(manifest.summary.outsideClosureNote).toContain('Outside K0 room-tick/packet closure');
    expect(manifest.summary.outsideClosureNote).toContain(
      '350 unimported client/outer-loop exports: 349 D2Common + D2Game.#10040 0x6FC4E460'
    );
    expect(manifest.summary.outsideClosureNote.toLowerCase()).not.toContain('realm/mcp/admin');

    // Verify >512B basic-block continuation decoding (e.g. WillOWisp AI 0x6FCA0F20: 3,410B, 24 callees)
    const willowispAi = fnByKey.get('D2Game:6FCA0F20');
    expect(willowispAi).toBeDefined();
    expect(willowispAi!.size).toBe(3410);
    expect(willowispAi!.callees.length).toBe(24);

    // Verify legacy single-word prose tokens ('seed', 'C2S', 'Item') are never used as function names
    for (const fn of manifest.functions) {
      expect(['seed', 'C2S', 'Item']).not.toContain(fn.name);
    }

    const { statusBreakdown, readySummary } = manifest.summary;
    expect(
      statusBreakdown['diff-verified'] + statusBreakdown.ported + statusBreakdown.unported
    ).toBe(manifest.summary.totalReachable);
    expect(readySummary.ready).toBe(
      readySummary.readyPureLeaf + readySummary.readyHostImport + readySummary.readyInternalComposite
    );
    expect(readySummary.readyPureLeaf).toBeGreaterThan(500);
    expect(readySummary.readyHostImport).toBeGreaterThan(200);

    const implementedKeys = new Set(
      manifest.functions
        .filter(f => f.status === 'diff-verified' || f.status === 'ported')
        .map(f => nodeKey(f.module, f.va))
    );
    const recomputedReady = manifest.functions.filter(
      f => f.status === 'unported' && f.callees.every(c => implementedKeys.has(c))
    );
    expect(recomputedReady.length).toBe(readySummary.ready);
    expect(
      recomputedReady.filter(f => f.callees.length === 0 && f.externalDeps.length === 0).length
    ).toBe(readySummary.readyPureLeaf);
    expect(recomputedReady.filter(f => f.externalDeps.length > 0).length).toBe(
      readySummary.readyHostImport
    );
    expect(
      recomputedReady.filter(f => f.callees.length > 0 && f.externalDeps.length === 0).length
    ).toBe(readySummary.readyInternalComposite);

    for (const fn of manifest.functions) {
      expect(['D2Game', 'D2Common']).toContain(fn.module);
      expect(fn.va).toMatch(/^0x6F[CD][0-9A-F]{5}$/);
      expect(fn.size).toBeGreaterThan(0);
      expect(fn.sccId).toBeGreaterThanOrEqual(0);
      expect(fn.sccId).toBeLessThan(manifest.summary.sccCount);
      expect(fn.topoLevel).toBeGreaterThanOrEqual(0);
      expect(fn.topoLevel).toBeLessThanOrEqual(manifest.summary.maxTopoLevel);
      expect(['diff-verified', 'ported', 'unported']).toContain(fn.status);

      const uKey = nodeKey(fn.module, fn.va);
      for (const calleeKey of fn.callees) {
        expect(calleeKey).not.toBe(uKey);
        const callee = fnByKey.get(calleeKey);
        expect(callee, `Missing callee ${calleeKey} from ${uKey}`).toBeDefined();
        expect(callee!.callers).toContain(uKey);
      }
      for (const callerKey of fn.callers) {
        const caller = fnByKey.get(callerKey);
        expect(caller, `Missing caller ${callerKey} to ${uKey}`).toBeDefined();
        expect(caller!.callees).toContain(uKey);
      }
    }
  });

  it('enforces Tarjan SCC mutual reachability and strict topological level invariants (0..maxTopoLevel)', () => {
    const maxLevel = manifest.summary.maxTopoLevel;
    expect(maxLevel).toBe(30);

    const levelPopulations = new Array<number>(maxLevel + 1).fill(0);
    const sccMembers = new Map<number, string[]>();

    for (const fn of manifest.functions) {
      levelPopulations[fn.topoLevel]++;
      const k = nodeKey(fn.module, fn.va);
      const list = sccMembers.get(fn.sccId) || [];
      list.push(k);
      sccMembers.set(fn.sccId, list);
    }

    for (let lvl = 0; lvl <= maxLevel; lvl++) {
      expect(levelPopulations[lvl], `Topological level ${lvl} should be non-empty`).toBeGreaterThan(0);
    }
    expect(sccMembers.size).toBe(manifest.summary.sccCount);

    for (const fn of manifest.functions) {
      let maxCrossSccCalleeLevel = -1;
      for (const calleeKey of fn.callees) {
        const callee = fnByKey.get(calleeKey)!;
        expect(callee.topoLevel).toBeLessThanOrEqual(fn.topoLevel);
        if (callee.sccId === fn.sccId) {
          expect(callee.topoLevel).toBe(fn.topoLevel);
        } else {
          expect(callee.topoLevel).toBeLessThan(fn.topoLevel);
          if (callee.topoLevel > maxCrossSccCalleeLevel) {
            maxCrossSccCalleeLevel = callee.topoLevel;
          }
        }
      }
      if (fn.topoLevel === 0) {
        expect(maxCrossSccCalleeLevel).toBe(-1);
      }
    }

    for (const [, members] of sccMembers) {
      if (members.length <= 1) continue;
      const memberSet = new Set(members);
      const root = members[0]!;

      const fwd = new Set<string>([root]);
      const fq = [root];
      while (fq.length > 0) {
        const cur = fq.pop()!;
        for (const nxt of fnByKey.get(cur)!.callees) {
          if (memberSet.has(nxt) && !fwd.has(nxt)) {
            fwd.add(nxt);
            fq.push(nxt);
          }
        }
      }
      expect(fwd.size).toBe(members.length);

      const bwd = new Set<string>([root]);
      const bq = [root];
      while (bq.length > 0) {
        const cur = bq.pop()!;
        for (const prev of fnByKey.get(cur)!.callers) {
          if (memberSet.has(prev) && !bwd.has(prev)) {
            bwd.add(prev);
            bq.push(prev);
          }
        }
      }
      expect(bwd.size).toBe(members.length);
    }
  });

  it('excludes switch jump-table case labels from standalone functions (spot-checking EvalStatWithOps 0x6FD89530)', () => {
    const evalStat = fnByKey.get('D2Common:6FD89530');
    expect(evalStat).toBeDefined();
    expect(evalStat!.size).toBeGreaterThanOrEqual(0x5bc);
    expect(evalStat!.size).toBeLessThanOrEqual(0x600);

    const evalStatJumpTableAndCases = [
      0x6fd89af0,
      0x6fd895d0,
      0x6fd8960d,
      0x6fd896aa,
      0x6fd8974b,
      0x6fd897dd,
      0x6fd89873,
      0x6fd898d2,
      0x6fd89947,
      0x6fd899c3,
      0x6fd89acf,
      0x6fd89a5c,
      0x6fd89a87,
    ];
    for (const caseVa of evalStatJumpTableAndCases) {
      expect(
        fnByKey.has(nodeKey('D2Common', caseVa)),
        `Switch case/table ${caseVa.toString(16)} must NOT be a standalone function`
      ).toBe(false);
    }
  });

  it('rejects 0xCC padding and single/multi-byte alignment NOPs at or immediately before function starts', () => {
    const npcInit = fnByKey.get('D2Game:6FC548A0');
    expect(npcInit).toBeDefined();
    expect(npcInit!.size).toBeGreaterThan(0x60);
    expect(fnByKey.has('D2Game:6FC548D0')).toBe(false);

    const updateFrame = fnByKey.get('D2Game:6FC4E050');
    expect(updateFrame).toBeDefined();
    expect(updateFrame!.size).toBeGreaterThanOrEqual(0x108);
    expect(updateFrame!.callees).toContain('D2Common:6FD8C800');

    for (const mod of ['D2Game', 'D2Common'] as const) {
      const modFns = manifest.functions
        .filter(f => f.module === mod)
        .map(f => ({ va: parseInt(f.va, 16), size: f.size, name: f.name }))
        .sort((a, b) => a.va - b.va);

      for (let i = 0; i + 1 < modFns.length; i++) {
        const cur = modFns[i]!;
        const nxt = modFns[i + 1]!;
        expect(
          nxt.va,
          `Overlap in ${mod}: ${cur.va.toString(16)}+${cur.size} overlaps ${nxt.va.toString(16)}`
        ).toBeGreaterThanOrEqual(cur.va + cur.size);
      }
    }

    // Forbidden alignment / padding byte sequences in MSVC 6.0 D2Game.dll & D2Common.dll
    const forbiddenPadPatterns: ReadonlyArray<{ label: string; bytes: readonly number[] }> = [
      { label: '90 (nop)', bytes: [0x90] },
      { label: '8B FF (mov edi, edi)', bytes: [0x8b, 0xff] },
      { label: '8D 49 00 (lea ecx, [ecx+0])', bytes: [0x8d, 0x49, 0x00] },
      { label: '8D 64 24 00 (lea esp, [esp+0])', bytes: [0x8d, 0x64, 0x24, 0x00] },
      { label: '8D 9B 00 00 00 00 (lea ebx, [ebx+0])', bytes: [0x8d, 0x9b, 0x00, 0x00, 0x00, 0x00] },
      {
        label: '8D A4 24 00 00 00 00 (lea esp, [esp+0])',
        bytes: [0x8d, 0xa4, 0x24, 0x00, 0x00, 0x00, 0x00],
      },
    ];

    const d2gameDll = path.join(D2_DATA_DIR, 'D2Game.dll');
    const d2commDll = path.join(D2_DATA_DIR, 'D2Common.dll');
    if (fs.existsSync(d2gameDll) && fs.existsSync(d2commDll)) {
      const pes: Record<'D2Game' | 'D2Common', LoadedPeInfo> = {
        D2Game: loadPeModule(d2gameDll, 0x6fc20000),
        D2Common: loadPeModule(d2commDll, 0x6fd50000),
      };

      for (const fn of manifest.functions) {
        const pe = pes[fn.module];
        const va = parseInt(fn.va, 16);
        expect(va).toBeGreaterThanOrEqual(pe.textStart);
        expect(va).toBeLessThan(pe.textEnd);

        const off = pe.vaToFileOffset(va);
        expect(pe.buf[off], `${fn.module} ${fn.va} starts on 0xCC int3 padding`).not.toBe(0xcc);

        for (const pat of forbiddenPadPatterns) {
          const startsWithPad = pat.bytes.every((b, idx) => pe.buf[off + idx] === b);
          expect(
            startsWithPad,
            `${fn.module} ${fn.va} starts on alignment NOP ${pat.label}`
          ).toBe(false);

          if (off - pat.bytes.length >= pe.textRawPtr) {
            const precededByPad = pat.bytes.every(
              (b, idx) => pe.buf[off - pat.bytes.length + idx] === b
            );
            expect(
              precededByPad,
              `${fn.module} ${fn.va} split immediately after interior alignment NOP ${pat.label}`
            ).toBe(false);
          }
        }
      }
    }
  });

  it('verifies all 45 dispatch tables, binary instruction evidence VAs, and bans stale 0x6FD294B8 / 0x6FD19528 across docs/ & kb/', () => {
    const d2gameTables = dispatchCfg.dispatchTables.filter(t => t.module === 'D2Game');
    const d2commTables = dispatchCfg.dispatchTables.filter(t => t.module === 'D2Common');

    expect(d2gameTables.length).toBe(35);
    expect(d2commTables.length).toBe(10);

    const byName = new Map(dispatchCfg.dispatchTables.map(t => [t.name, t]));
    for (const expected of [
      'topLevelStages',
      'c2sPacketTable',
      'c2sHandshakePacketTable',
      'monsterModeEventTable',
      'tradeActionCallbacksTable',
      'shrinesEffectDispatchTable',
      'itemActionPacketSubTable',
      'skillsSrvStFuncTable',
      'skillsSrvDoFuncTable',
      'playerSkillModeHandlersTable',
      'questsCallbacksTable',
      'objectsPopulateDispatchTable',
      'objectsInitFnTable',
      'objectsOperateFnTable',
      'shrinesOperateFnTable',
      'missilesSrvDoFuncTable',
      'monUModTable',
      'gpHirelingAndPetAiFunctionTable',
      'gpMonsterAiFunctionTable',
      'monUModCallbackMatrixTable',
      'npcPathNodeActionTable',
      'drlgOutdoorActPresetTables',
      'pathMovementTypeTable',
      'drlgLevelAlgoTable',
      'skillsCalcBuiltinsTable',
      'missilesCalcBuiltinsTable',
      'statCalcBuiltinsTable',
      'itemsPropertyAssignTable',
      'itemsModFuncTable',
    ]) {
      expect(byName.has(expected), `Missing dispatch table ${expected}`).toBe(true);
    }

    expect(byName.get('topLevelStages')!.entries![3]!.evidence).toContain('[2, 0, 1, 3, 4]');
    expect(byName.get('tradeActionCallbacksTable')!.baseAddress).toBe('0x6FD1A5E8');
    expect(byName.get('tradeActionCallbacksTable')!.count).toBe(4);
    expect(byName.get('shrinesEffectDispatchTable')!.baseAddress).toBe('0x6FD1A5F8');
    expect(byName.get('shrinesEffectDispatchTable')!.count).toBe(24);
    expect(byName.get('itemActionPacketSubTable')!.baseAddress).toBe('0x6FD22CE0');
    expect(byName.get('itemActionPacketSubTable')!.count).toBe(20);
    expect(byName.get('itemActionPacketSubTable')!.description).toContain('dwAnimMode');
    expect(byName.get('objectsPopulateDispatchTable')!.baseAddress).toBe('0x6FD2D928');
    expect(byName.get('objectsPopulateDispatchTable')!.count).toBe(9);
    expect(byName.get('monUModCallbackMatrixTable')!.baseAddress).toBe('0x6FD2F448');
    expect(byName.get('monUModCallbackMatrixTable')!.stride).toBe(24);
    expect(byName.get('monUModCallbackMatrixTable')!.count).toBe(43);
    expect(byName.get('npcPathNodeActionTable')!.baseAddress).toBe('0x6FD2F850');
    expect(byName.get('npcPathNodeActionTable')!.count).toBe(7);

    // Verify 0 hits for bogus 0x6FD294B8 and bogus D2Net IAT 0x6FD19528 across docs/, kb/, and tools/oracle/callgraph/
    const exts = new Set(['.md', '.json']);
    const scanFiles = [
      ...collectFilesRecursive(path.join(REPO_ROOT, 'docs'), exts),
      ...collectFilesRecursive(path.join(REPO_ROOT, 'kb'), exts),
      ...collectFilesRecursive(path.join(REPO_ROOT, 'tools', 'oracle', 'callgraph'), exts),
    ];
    expect(scanFiles.length).toBeGreaterThan(180);
    for (const filePath of scanFiles) {
      const lower = fs.readFileSync(filePath, 'utf-8').toLowerCase();
      const rel = path.relative(REPO_ROOT, filePath);
      expect(lower, `Stale bogus VA 0x6FD294B8 in ${rel}`).not.toContain('6fd294b8');
      expect(lower, `Stale bogus D2Net IAT VA 0x6FD19528 in ${rel}`).not.toContain('6fd19528');
    }

    // Binary verification of every evidence instruction VA in dispatch-tables-113c.json
    const d2gameDll = path.join(D2_DATA_DIR, 'D2Game.dll');
    const d2commDll = path.join(D2_DATA_DIR, 'D2Common.dll');
    if (fs.existsSync(d2gameDll) && fs.existsSync(d2commDll)) {
      const pes: Record<'D2Game' | 'D2Common', LoadedPeInfo> = {
        D2Game: loadPeModule(d2gameDll, 0x6fc20000),
        D2Common: loadPeModule(d2commDll, 0x6fd50000),
      };

      // Confirm itemActionPacketSubTable row 19 -> 0x6FCEBA20 in D2Game.dll
      const row19Off = pes.D2Game.vaToFileOffset(0x6fd22ce0 + 19 * 12);
      expect(pes.D2Game.buf.readUInt32LE(row19Off)).toBe(0x6fceba20);
      expect(fnByKey.has('D2Game:6FCEBA20')).toBe(true);
      expect(fnByKey.has('D2Game:6FC90170')).toBe(true); // tradeActionCallbacksTable[3]

      for (const tbl of dispatchCfg.dispatchTables) {
        const pe = pes[tbl.module];
        if (tbl.type === 'sequentialCalls') {
          expect(tbl.entries && tbl.entries.length).toBeGreaterThan(0);
          for (const ent of tbl.entries!) {
            const m = ent.evidence.match(/^0x([0-9A-Fa-f]{8})\b/);
            expect(m, `Missing call-site VA in ${tbl.name}[${ent.index}]`).not.toBeNull();
            const siteVa = parseInt(m![1]!, 16);
            expect(siteVa).toBeGreaterThanOrEqual(pe.textStart);
            expect(siteVa).toBeLessThan(pe.textEnd);
            const off = pe.vaToFileOffset(siteVa);
            expect(pe.buf[off], `${tbl.name}[${ent.index}] at 0x${siteVa.toString(16)} is not E8 call`).toBe(
              0xe8
            );
            const rel32 = pe.buf.readInt32LE(off + 1);
            const targetVa = (siteVa + 5 + rel32) >>> 0;
            expect(targetVa).toBe(parseInt(ent.va, 16));
          }
          continue;
        }

        const baseAddr = parseInt(tbl.baseAddress, 16);
        const tableSpan = (tbl.stride || 4) * (tbl.count || 1);
        const tableEnd = baseAddr + tableSpan;
        expect(tbl.evidence && tbl.evidence.length).toBeGreaterThan(10);

        const strippedEvidence = tbl.evidence!.replace(/\([^)]*\)/g, '');
        const clauseMatches = [
          ...strippedEvidence.matchAll(/0x([0-9A-Fa-f]{8})\s+(mov|call|add|lea|push|jmp)\b/g),
        ];
        expect(
          clauseMatches.length,
          `Table ${tbl.name} evidence '${tbl.evidence}' must cite at least one '0xVA <mnemonic>' instruction`
        ).toBeGreaterThan(0);

        for (const m of clauseMatches) {
          const insnVa = parseInt(m[1]!, 16);
          const mnem = m[2]!.toLowerCase();
          expect(insnVa).toBeGreaterThanOrEqual(pe.textStart);
          expect(insnVa).toBeLessThan(pe.textEnd);
          const off = pe.vaToFileOffset(insnVa);
          const op0 = pe.buf[off]!;
          if (mnem === 'mov') {
            expect([0x8b, 0x8a, 0xa1, 0xa3, 0xb8, 0xb9, 0xba, 0xbb, 0xbc, 0xbd, 0xbe, 0xbf, 0xc7]).toContain(
              op0
            );
          } else if (mnem === 'call') {
            expect([0xff, 0xe8]).toContain(op0);
            if (op0 === 0xff) {
              expect(pe.buf[off + 1]! & 0x38).toBe(0x10);
            }
          } else if (mnem === 'add') {
            expect([0x03, 0x05, 0x81, 0x83]).toContain(op0);
          } else if (mnem === 'lea') {
            expect(op0).toBe(0x8d);
          } else if (mnem === 'push') {
            expect(op0).toBe(0x68);
          } else if (mnem === 'jmp') {
            expect(op0).toBe(0xff);
            expect(pe.buf[off + 1]! & 0x38).toBe(0x20);
          }

          let encodesTable = false;
          for (let delta = 1; delta <= 6; delta++) {
            const imm = pe.buf.readUInt32LE(off + delta);
            if (imm >= baseAddr && imm < tableEnd) {
              encodesTable = true;
              break;
            }
          }
          expect(
            encodesTable,
            `Instruction at 0x${insnVa.toString(16)} (${mnem}) in ${tbl.name} does not encode [${tbl.baseAddress}, 0x${tableEnd.toString(16)})`
          ).toBe(true);
        }
      }

      for (const ptbl of dispatchCfg.pruned_roots_and_funcs.prunedDataTables || []) {
        const pe = pes[ptbl.module];
        const baseAddr = parseInt(ptbl.baseAddress, 16);
        const tableEnd = baseAddr + ptbl.stride * ptbl.count;
        const clauseMatches = [
          ...ptbl.evidence.replace(/\([^)]*\)/g, '').matchAll(/0x([0-9A-Fa-f]{8})\s+(mov|call|add|lea)\b/g),
        ];
        if (ptbl.baseAddress === '0x6FD2E3D0') {
          expect(clauseMatches.length).toBeGreaterThanOrEqual(2);
        }
        for (const m of clauseMatches) {
          const insnVa = parseInt(m[1]!, 16);
          const off = pe.vaToFileOffset(insnVa);
          let encodesTable = false;
          for (let delta = 1; delta <= 6; delta++) {
            const imm = pe.buf.readUInt32LE(off + delta);
            if (imm >= baseAddr && imm < tableEnd) {
              encodesTable = true;
              break;
            }
          }
          expect(encodesTable).toBe(true);
        }
      }
    }
  });

  it('documents and excludes pruned host/CRT/Realm/crash infrastructure from the active kernel closure', () => {
    const { pruned_roots_and_funcs } = dispatchCfg;
    expect(pruned_roots_and_funcs.prunedCallSiteRanges.length).toBeGreaterThanOrEqual(1);
    expect(pruned_roots_and_funcs.prunedCodeRanges.length).toBeGreaterThanOrEqual(6);
    expect(pruned_roots_and_funcs.prunedFunctions.length).toBeGreaterThanOrEqual(15);

    const crashBranch = pruned_roots_and_funcs.prunedCallSiteRanges.find(
      r => r.containingFn === '0x6FC4E050'
    );
    expect(crashBranch).toBeDefined();
    expect(manifest.pruned.prunedCallSitesSkipped.length).toBe(4);
    expect(manifest.summary.prunedCount).toBe(manifest.pruned.entries.length);

    for (const pf of pruned_roots_and_funcs.prunedFunctions) {
      expect(pf.reason.length).toBeGreaterThan(10);
      expect(pf.evidence.length).toBeGreaterThan(10);
      expect(fnByKey.has(nodeKey(pf.module, pf.va))).toBe(false);
    }

    for (const pe of manifest.pruned.entries) {
      expect(fnByKey.has(nodeKey(pe.module, pe.va))).toBe(false);
    }

    for (const rng of pruned_roots_and_funcs.prunedCodeRanges) {
      const lo = parseInt(rng.start, 16);
      const hi = parseInt(rng.end, 16);
      for (const fn of manifest.functions) {
        if (fn.module !== rng.module) continue;
        const va = parseInt(fn.va, 16);
        expect(
          va < lo || va >= hi,
          `Pruned ${rng.category} function ${fn.va} leaked into ${rng.module} closure`
        ).toBe(true);
      }
    }
  });

  it('enforces 1-to-1 VA/symbol binding and strict diff-verified vs ported provenance in src/d2kern-113c/', () => {
    const verifiedFns = manifest.functions.filter(f => f.status === 'diff-verified');
    const portedFns = manifest.functions.filter(f => f.status === 'ported');
    const legacyFns = manifest.functions.filter(f => f.legacyRef !== undefined);

    expect(verifiedFns.length).toBe(manifest.summary.statusBreakdown['diff-verified']);
    expect(portedFns.length).toBe(manifest.summary.statusBreakdown.ported);
    expect(verifiedFns.length).toBe(89);
    expect(portedFns.length).toBe(40);

    // Verify docs/oracle/function-map.md K0 ported row matches manifest-113c.json 1-to-1
    const fnMapText = fs.readFileSync(path.join(REPO_ROOT, 'docs', 'oracle', 'function-map.md'), 'utf-8');
    expect(fnMapText).toContain('**`89` `diff-verified` (`1.85%`) + `40` `ported` (`0.83%`)');
    const portedRow = fnMapText.split('\n').find(line => line.includes('| **ported** (`40` closure functions'));
    expect(portedRow).toBeDefined();
    const portedRowVas = [...portedRow!.split('|')[1]!.matchAll(/0x6F[CD][0-9A-Fa-f]{5}/g)].map(m =>
      m[0]!.toLowerCase()
    );
    expect(portedRowVas.length).toBe(40);
    for (const fn of portedFns) {
      expect(portedRowVas).toContain(fn.va.toLowerCase());
    }

    // Unexercised or unit-tested 100%-complete helpers in src/d2kern-113c/ must be classified as 'ported', while slice-scoped helpers remain 'unported'
    expect(fnByKey.get('D2Game:6FCA38B0')!.status).toBe('ported'); // AiZombie (dormant in F786..F825)
    expect(fnByKey.get('D2Game:6FC96FE0')!.status).toBe('ported'); // MONSTER_StepRun (Fallen only walk in WL=2)
    expect(fnByKey.get('D2Common:6FD8A330')!.status).toBe('ported'); // STATLIST_AddStat
    expect(fnByKey.get('D2Common:6FD88520')!.status).toBe('ported'); // STATLIST_GetStatListFromUnitAndState
    expect(fnByKey.get('D2Game:6FCBD160')!.status).toBe('unported'); // slice-scoped target acquisition helper
    expect(fnByKey.get('D2Game:6FD13220')!.status).toBe('unported'); // slice-scoped fallback helper
    expect(fnByKey.get('D2Game:6FCFE5A0')!.status).toBe('unported'); // slice-scoped combat wrapper
    for (const demotedKey of [
      'D2Game:6FC97CB0',
      'D2Game:6FC97950',
      'D2Game:6FC97A50',
      'D2Game:6FC40EC0',
      'D2Game:6FC94F20',
      'D2Game:6FC95260',
      'D2Common:6FD6E670',
      'D2Game:6FC572C0',
      'D2Common:6FD9F640',
      'D2Common:6FD8C390',
    ]) {
      const fn = fnByKey.get(demotedKey)!;
      expect(fn.status, `${demotedKey} (${fn.name}) should be 'ported'`).toBe('ported');
      expect(fn.diffEvidence).toContain('tests/oracle/kern-fallen-f790-f821.test.ts');
    }

    // Verify corrected symbol names from binary audit (#41)
    expect(fnByKey.get('D2Common:6FD83C20')!.name).toBe('STATES_CheckStateMaskOnUnit');
    expect(fnByKey.get('D2Common:6FD6E670')!.name).toBe('INVENTORY_GetItemFromBodyLoc');
    expect(fnByKey.get('D2Game:6FC572C0')!.name).toBe('PLAYER_GetEquippedWeapon');
    expect(fnByKey.get('D2Common:6FD9F640')!.name).toBe('SKILLS_GetWeaponMasteryBonus');
    expect(fnByKey.get('D2Common:6FD8C390')!.name).toBe('DUNGEON_CheckRoomIsTown');
    expect(fnByKey.get('D2Common:6FD803E0')!.name).toBe('SKILLS_SetUsedSkill');
    expect(fnByKey.get('D2Game:6FC40F30')!.name).toBe('AIGENERAL_AllocAiCommand');
    expect(fnByKey.get('D2Game:6FC41290')!.name).toBe('AIGENERAL_InitAiCommand');
    expect(fnByKey.get('D2Common:6FD511E0')!.name).toBe('COMMON_MulDiv');
    expect(fnByKey.get('D2Game:6FD02240')!.name).toBe('MONSTER_SetUninterruptableAndClearAiEvents');
    expect(fnByKey.get('D2Game:6FC4A900')!.name).toBe('GAME_InitSeed');
    expect(fnByKey.get('D2Game:6FC21180')!.name).toBe('SEED_RollLimitedRandomNumber');
    expect(fnByKey.get('D2Common:6FD510B0')!.name).toBe('SEED_RollRandomNumber');

    // Verify every @va-tagged closure function across src/d2kern-113c/**/*.ts is bound in manifest-113c.json
    const kernTsFiles = collectFilesRecursive(path.join(REPO_ROOT, 'src', 'd2kern-113c'), new Set(['.ts']));
    const vaTagRegex = /@va\s+(D2Game|D2Common):(0x[0-9A-Fa-f]{8})\b/g;
    for (const tsFile of kernTsFiles) {
      const content = fs.readFileSync(tsFile, 'utf-8');
      for (const m of content.matchAll(vaTagRegex)) {
        const key = nodeKey(m[1]!, m[2]!);
        const fn = fnByKey.get(key);
        if (fn !== undefined) {
          expect(
            ['diff-verified', 'ported'],
            `@va ${key} in ${path.relative(REPO_ROOT, tsFile)} is unported in manifest-113c.json`
          ).toContain(fn.status);
        }
      }
    }

    const seenNames = new Set<string>();
    const fileCache = new Map<string, string>();
    const oracleTestRegex = /tests\/oracle\/[A-Za-z0-9_./-]+\.test\.ts/g;

    for (const fn of [...verifiedFns, ...portedFns]) {
      expect(fn.name).not.toMatch(/^D2(Game|Common)_[0-9A-F]{8}$/);
      expect(seenNames.has(fn.name), `Duplicate symbol name ${fn.name} on ${fn.va}`).toBe(false);
      seenNames.add(fn.name);

      expect(fn.kernFile, `${fn.va} (${fn.name}) missing kernFile`).toBeDefined();
      expect(fn.kernFile!.startsWith('src/d2kern-113c/')).toBe(true);
      expect(fn.tsSymbol && fn.tsSymbol.length).toBeGreaterThan(2);

      const absPath = path.join(REPO_ROOT, fn.kernFile!);
      expect(fs.existsSync(absPath), `Missing disk file ${fn.kernFile} for ${fn.va}`).toBe(true);
      if (!fileCache.has(fn.kernFile!)) {
        fileCache.set(fn.kernFile!, fs.readFileSync(absPath, 'utf-8'));
      }
      const srcText = fileCache.get(fn.kernFile!)!;
      expect(
        srcText.toLowerCase().includes(fn.va.toLowerCase()),
        `${fn.kernFile} does not document exact VA ${fn.va} for ${fn.name}`
      ).toBe(true);
      expect(
        srcText.includes(fn.tsSymbol!),
        `${fn.kernFile} does not contain tsSymbol ${fn.tsSymbol} for ${fn.va}`
      ).toBe(true);

      if (fn.status === 'diff-verified') {
        expect(fn.diffEvidence && fn.diffEvidence.length).toBeGreaterThan(15);
        const testRefs = fn.diffEvidence!.match(oracleTestRegex) || [];
        expect(
          testRefs.length,
          `diff-verified ${fn.va} (${fn.name}) must cite at least one tests/oracle/*.test.ts file`
        ).toBeGreaterThan(0);
        for (const relTest of testRefs) {
          expect(
            fs.existsSync(path.join(REPO_ROOT, relTest)),
            `Missing oracle test ${relTest} cited by ${fn.va}`
          ).toBe(true);
        }
      } else if (fn.diffEvidence !== undefined) {
        expect(fn.diffEvidence.length).toBeGreaterThan(15);
        for (const relTest of fn.diffEvidence.match(oracleTestRegex) || []) {
          expect(
            fs.existsSync(path.join(REPO_ROOT, relTest)),
            `Missing oracle test ${relTest} cited by ${fn.va}`
          ).toBe(true);
        }
      }
    }

    expect(legacyFns.length).toBe(manifest.summary.legacyRefCount);
    expect(legacyFns.length).toBeGreaterThan(20);
    for (const fn of legacyFns) {
      expect(fn.status).toBe('unported');
      expect(fn.kernFile).toBeUndefined();
    }
  });
});

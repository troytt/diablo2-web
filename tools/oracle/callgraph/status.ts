/**
 * Diablo II v1.13c Isomorphic Server Kernel Call Graph Status Board.
 *
 * Reads manifest-113c.json and reports src/d2kern-113c/ verification progress,
 * host-infrastructure pruning counts, factual outside-closure breakdowns,
 * ready-frontier splits (readyPureLeaf vs readyHostImport vs readyInternalComposite),
 * legacy parity reference counts (never conflated with src/d2kern-113c/ ports),
 * topological layering, and next unblocked leaf work orders.
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type KernelFnStatus = 'diff-verified' | 'ported' | 'unported';

export interface PrunedEntry {
  va: string;
  module: 'D2Game' | 'D2Common';
  name: string;
  category: string;
  reason: string;
  evidence: string;
}

export interface FunctionEntry {
  va: string;
  module: 'D2Game' | 'D2Common';
  name: string;
  size: number;
  sccId: number;
  topoLevel: number;
  status: KernelFnStatus;
  callees: string[];
  callers: string[];
  externalDeps: string[];
  indirectUnknown?: boolean;
  kernFile?: string;
  tsSymbol?: string;
  tsReference?: string;
  diffEvidence?: string;
  legacyRef?: string;
}

export interface ReadySummary {
  ready: number;
  readyPureLeaf: number;
  readyHostImport: number;
  readyInternalComposite: number;
}

export interface Manifest {
  version: string;
  generatedAt: string;
  summary: {
    totalReachable: number;
    d2GameReachable: number;
    d2CommonReachable: number;
    sccCount: number;
    maxTopoLevel: number;
    prunedCount: number;
    outsideClosureD2GameCount: number;
    outsideClosureD2CommonCount: number;
    outsideClosureNote: string;
    legacyRefCount: number;
    readySummary: ReadySummary;
    statusBreakdown: {
      'diff-verified': number;
      ported: number;
      unported: number;
    };
  };
  pruned: {
    prunedCallSitesSkipped: string[];
    entries: PrunedEntry[];
  };
  functions: FunctionEntry[];
}

function printHeader(title: string): void {
  console.log(`\n================================================================================`);
  console.log(`  ${title}`);
  console.log(`================================================================================`);
}

export function runStatusCli(): void {
  const manifestPath = path.join(__dirname, 'manifest-113c.json');
  if (!fs.existsSync(manifestPath)) {
    console.error(`Error: manifest file not found at ${manifestPath}`);
    console.error(`Please run extract-callgraph.py first.`);
    process.exit(1);
  }

  const raw = fs.readFileSync(manifestPath, 'utf-8');
  const manifest: Manifest = JSON.parse(raw);
  const { summary, functions } = manifest;

  printHeader(`Diablo II v1.13c Server Core Call Graph Status (K0)`);
  console.log(`Version:             ${manifest.version}`);
  console.log(`Generated At:        ${manifest.generatedAt}`);
  console.log(`Total Reachable:     ${summary.totalReachable} kernel functions`);
  console.log(`  - D2Game.dll:      ${summary.d2GameReachable}`);
  console.log(`  - D2Common.dll:    ${summary.d2CommonReachable}`);
  console.log(
    `Pruned Host/CRT:     ${summary.prunedCount} targets (${manifest.pruned.prunedCallSitesSkipped.length} crash call-sites skipped)`
  );
  console.log(
    `Outside K0 Closure:  ${summary.outsideClosureD2GameCount} D2Game + ${summary.outsideClosureD2CommonCount} D2Common`
  );
  console.log(`  - Breakdown:       ${summary.outsideClosureNote}`);
  console.log(`SCC Units:           ${summary.sccCount}`);
  console.log(`Max Topo Depth:      Level ${summary.maxTopoLevel}`);

  printHeader(`Porting, Verification & Unblocked Ready Frontier (src/d2kern-113c/ ONLY)`);
  const total = summary.totalReachable || 1;
  const verified = summary.statusBreakdown['diff-verified'] || 0;
  const ported = summary.statusBreakdown.ported || 0;
  const unported = summary.statusBreakdown.unported || 0;
  const { ready, readyPureLeaf, readyHostImport, readyInternalComposite } = summary.readySummary;

  const pct = (n: number) => ((n / total) * 100).toFixed(2);
  console.log(
    `[+] diff-verified:   ${String(verified).padStart(5)} (${pct(verified)}%) [src/d2kern-113c/ real-DLL differential parity]`
  );
  console.log(
    `[~] ported:          ${String(ported).padStart(5)} (${pct(ported)}%) [src/d2kern-113c/ implemented, awaiting DLL harness]`
  );
  console.log(
    `[-] unported:        ${String(unported).padStart(5)} (${pct(unported)}%) [Not yet ported to src/d2kern-113c/]`
  );
  console.log(
    `[>] ready (total):   ${String(ready).padStart(5)} unported fns with 0 unported closure callees:`
  );
  console.log(
    `      - readyPureLeaf:          ${String(readyPureLeaf).padStart(5)} (0 closure callees & 0 external DLL imports)`
  );
  console.log(
    `      - readyHostImport:        ${String(readyHostImport).padStart(5)} (0 unported closure callees; calls Fog/Storm/D2CMP/D2Net/Win32)`
  );
  console.log(
    `      - readyInternalComposite: ${String(readyInternalComposite).padStart(5)} (>0 closure callees, all ported/diff-verified; 0 external imports)`
  );
  console.log(
    `(i) legacyRef:       ${String(summary.legacyRefCount).padStart(5)} unported fns have legacy src/server|common|client refs`
  );

  printHeader(`Topological Level Breakdown (Layers 0..${summary.maxTopoLevel})`);
  const levelCounts: Record<
    number,
    { total: number; verified: number; ported: number; ready: number; readyPure: number; readyHost: number }
  > = {};
  for (let l = 0; l <= summary.maxTopoLevel; l++) {
    levelCounts[l] = { total: 0, verified: 0, ported: 0, ready: 0, readyPure: 0, readyHost: 0 };
  }

  const implementedKeys = new Set(
    functions
      .filter(f => f.status === 'diff-verified' || f.status === 'ported')
      .map(f => `${f.module}:${f.va.slice(2)}`.toUpperCase())
  );

  for (const fn of functions) {
    const stat = levelCounts[fn.topoLevel];
    if (!stat) continue;
    stat.total++;
    if (fn.status === 'diff-verified') {
      stat.verified++;
    } else if (fn.status === 'ported') {
      stat.ported++;
    } else {
      const unportedCallees = fn.callees.filter(c => !implementedKeys.has(c.toUpperCase()));
      if (unportedCallees.length === 0 && !fn.indirectUnknown) {
        stat.ready++;
        if (fn.callees.length === 0 && fn.externalDeps.length === 0) {
          stat.readyPure++;
        } else if (fn.externalDeps.length > 0) {
          stat.readyHost++;
        }
      }
    }
  }

  console.log(` Level | Functions | DiffVer | Ported | Ready (Pure/Host) | Progress`);
  console.log(`-------+-----------+---------+--------+-------------------+--------------------------`);
  for (let l = 0; l <= Math.min(10, summary.maxTopoLevel); l++) {
    const s = levelCounts[l]!;
    const bar = Math.round((s.verified / (s.total || 1)) * 16);
    const barStr = `[${'#'.repeat(bar)}${'-'.repeat(16 - bar)}]`;
    const rdyStr = `${String(s.ready).padStart(4)} (${String(s.readyPure).padStart(3)}/${String(s.readyHost).padStart(3)})`;
    console.log(
      `   ${String(l).padStart(2)}  |   ${String(s.total).padStart(6)}  |  ${String(s.verified).padStart(5)}  | ${String(s.ported).padStart(5)}  | ${rdyStr.padStart(17)} | ${barStr} ${((s.verified / (s.total || 1)) * 100).toFixed(1)}%`
    );
  }
  if (summary.maxTopoLevel > 10) {
    let higherTotal = 0;
    let higherVerified = 0;
    let higherPorted = 0;
    let higherReady = 0;
    let higherPure = 0;
    let higherHost = 0;
    for (let l = 11; l <= summary.maxTopoLevel; l++) {
      higherTotal += levelCounts[l]!.total;
      higherVerified += levelCounts[l]!.verified;
      higherPorted += levelCounts[l]!.ported;
      higherReady += levelCounts[l]!.ready;
      higherPure += levelCounts[l]!.readyPure;
      higherHost += levelCounts[l]!.readyHost;
    }
    const rdyStr = `${String(higherReady).padStart(4)} (${String(higherPure).padStart(3)}/${String(higherHost).padStart(3)})`;
    console.log(
      ` 11..${summary.maxTopoLevel}|   ${String(higherTotal).padStart(6)}  |  ${String(higherVerified).padStart(5)}  | ${String(higherPorted).padStart(5)}  | ${rdyStr.padStart(17)} |`
    );
  }

  printHeader(`Next Work Orders: Unblocked Pure-Leaf Functions (0 Callees, 0 Imports — Top 12)`);
  const pureLeaves = functions
    .filter(f => f.status === 'unported' && f.callees.length === 0 && f.externalDeps.length === 0 && !f.indirectUnknown)
    .sort((a, b) => b.callers.length - a.callers.length || a.va.localeCompare(b.va));

  console.log(`Found ${pureLeaves.length} unported pure-leaf functions (0 closure callees, 0 external DLL imports).`);
  console.log(`Ranked by number of inbound callers (highest fan-in first):\n`);
  console.log(`  VA          Module     Size   Callers  Name`);
  console.log(`  ----------  ---------  -----  -------  ---------------------------------------`);
  for (const fn of pureLeaves.slice(0, 12)) {
    console.log(
      `  ${fn.va}  ${fn.module.padEnd(9)}  ${String(fn.size).padStart(4)}B  ${String(fn.callers.length).padStart(7)}  ${fn.name}`
    );
  }
  console.log(`\n================================================================================\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  runStatusCli();
}

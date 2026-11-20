#!/usr/bin/env python3
"""Idempotent AST-based VA trace instrumentation for src/d2kern-113c/**/*.ts.

Reads tools/oracle/callgraph/manifest-113c.json and ensures every `ported` /
`diff-verified` function's `tsSymbol` in `src/d2kern-113c/**/*.ts` invokes
`hitD2CommonVa113c(0x...)` / `hitD2GameVa113c(0x...)` as its leading statement(s),
while stripping stale hit calls from unported/unbound functions.

Usage:
  python3 tools/oracle/callgraph/instrument-va-trace.py --check
  python3 tools/oracle/callgraph/instrument-va-trace.py --apply
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))

NODE_SCRIPT = r"""
const fs = require('fs');
const path = require('path');

const repoRoot = process.env.D2W_REPO_ROOT;
const mode = process.env.D2W_MODE;
const tsPath = path.join(repoRoot, 'node_modules', 'typescript', 'lib', 'typescript.js');
const ts = require(tsPath);

const manifestPath = path.join(repoRoot, 'tools', 'oracle', 'callgraph', 'manifest-113c.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const DONE = new Set(['ported', 'diff-verified']);
// Map: kernFile -> Map(tsSymbol -> Array<{ module, vaHex }>)
const byFile = new Map();
for (const fn of manifest.functions) {
  if (!DONE.has(fn.status)) continue;
  if (!fn.kernFile || !fn.tsSymbol) continue;
  if (fn.kernFile === 'src/d2kern-113c/va-trace-113c.ts') continue;
  let symMap = byFile.get(fn.kernFile);
  if (!symMap) {
    symMap = new Map();
    byFile.set(fn.kernFile, symMap);
  }
  let list = symMap.get(fn.tsSymbol);
  if (!list) {
    list = [];
    symMap.set(fn.tsSymbol, list);
  }
  const vaNum = parseInt(fn.va, 16) >>> 0;
  const vaHex = '0x' + vaNum.toString(16).toUpperCase().padStart(8, '0');
  list.push({ module: fn.module, vaNum, vaHex });
}

for (const symMap of byFile.values()) {
  for (const list of symMap.values()) {
    list.sort((a, b) => (a.module < b.module ? -1 : a.module > b.module ? 1 : a.vaNum - b.vaNum));
  }
}

function collectTsFiles(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...collectTsFiles(p));
    else if (ent.name.endsWith('.ts')) out.push(p);
  }
  return out.sort();
}

const kernDir = path.join(repoRoot, 'src', 'd2kern-113c');
const allFiles = collectTsFiles(kernDir).map(abs => path.relative(repoRoot, abs).replace(/\\/g, '/'));

const HIT_STMT_RE = /^\s*hitD2(?:Common|Game)Va113c\(0x[0-9A-Fa-f]{8}\);?\s*$/;

function detectStyle(src) {
  let ext = '.ts';
  const impMatch = src.match(/from\s+['"](\.[^'"]+)['"]/);
  if (impMatch) {
    if (impMatch[1].endsWith('.ts')) ext = '.ts';
    else if (impMatch[1].endsWith('.js')) ext = '.js';
    else ext = '';
  }
  const semi = /from\s+['"][^'"]+['"];/.test(src) ? ';' : '';
  return { ext, semi };
}

let dirtyFiles = 0;
let instrumentedSyms = 0;

for (const relFile of allFiles) {
  if (relFile === 'src/d2kern-113c/va-trace-113c.ts' || relFile === 'src/d2kern-113c/index.ts') {
    continue;
  }
  const absFile = path.join(repoRoot, relFile);
  const orig = fs.readFileSync(absFile, 'utf8');
  const symMap = byFile.get(relFile) || new Map();

  const sf = ts.createSourceFile(absFile, orig, ts.ScriptTarget.Latest, true);
  const edits = []; // { start, end, text }
  const neededHelpers = new Set();

  // Map top-level symbols to their AST function/variable node
  const topDecls = new Map();
  let lastImportEnd = 0;
  let existingVaTraceImport = null;

  for (const st of sf.statements) {
    if (ts.isImportDeclaration(st)) {
      lastImportEnd = st.getEnd();
      const spec = st.moduleSpecifier.getText(sf).slice(1, -1);
      if (spec.endsWith('/va-trace-113c') || spec.endsWith('/va-trace-113c.ts') || spec.endsWith('/va-trace-113c.js') || spec === './va-trace-113c' || spec === './va-trace-113c.ts' || spec === './va-trace-113c.js') {
        existingVaTraceImport = st;
      }
    } else if (ts.isFunctionDeclaration(st) && st.name && st.body) {
      topDecls.set(st.name.text, { kind: 'fn', node: st, body: st.body });
    } else if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && d.initializer) {
          if (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer)) {
            topDecls.set(d.name.text, { kind: 'arrow', node: d.initializer, body: d.initializer.body });
          } else if (ts.isIdentifier(d.initializer)) {
            topDecls.set(d.name.text, { kind: 'alias', declStmt: st, decl: d, targetIdent: d.initializer.text });
          }
        }
      }
    }
  }

  for (const sym of symMap.keys()) {
    if (!topDecls.has(sym)) {
      console.error(`[instrument-va-trace] Missing top-level symbol ${sym} in ${relFile}`);
      process.exit(2);
    }
  }

  const { ext, semi } = detectStyle(orig);

  for (const [sym, info] of topDecls.entries()) {
    const entries = symMap.get(sym) || [];
    for (const e of entries) {
      neededHelpers.add(e.module === 'D2Common' ? 'hitD2CommonVa113c' : 'hitD2GameVa113c');
    }
    if (entries.length > 0) instrumentedSyms++;

    const hitCalls = entries.map(e => {
      const fnName = e.module === 'D2Common' ? 'hitD2CommonVa113c' : 'hitD2GameVa113c';
      return `${fnName}(${e.vaHex})${semi}`;
    });

    if (info.kind === 'alias') {
      if (entries.length === 0) continue;
      // Convert `export const SYM = TARGET` into wrapper function preserving behavior
      const isExported = info.declStmt.modifiers && info.declStmt.modifiers.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
      if (info.declStmt.declarationList.declarations.length !== 1) {
        console.error(`[instrument-va-trace] Multi-declarator alias not supported for ${sym} in ${relFile}`);
        process.exit(2);
      }
      const prefix = isExported ? 'export ' : '';
      const replacement = `${prefix}function ${sym}(...args: Parameters<typeof ${info.targetIdent}>): ReturnType<typeof ${info.targetIdent}> {\n  ${hitCalls.join('\n  ')}\n  return ${info.targetIdent}(...args)${semi}\n}`;
      edits.push({ start: info.declStmt.getStart(sf), end: info.declStmt.getEnd(), text: replacement });
      continue;
    }

    const body = info.body;
    if (!ts.isBlock(body)) {
      if (entries.length === 0) continue;
      const exprText = body.getText(sf);
      const replacement = `{\n  ${hitCalls.join('\n  ')}\n  return ${exprText}${semi}\n}`;
      edits.push({ start: body.getStart(sf), end: body.getEnd(), text: replacement });
      continue;
    }

    // Block body: inspect existing leading hitD2*Va113c statements right after `{`
    const openBracePos = body.getStart(sf); // position of `{`
    const closeBracePos = body.getEnd() - 1; // position of `}`
    const innerRaw = orig.slice(openBracePos + 1, closeBracePos);
    const innerLines = innerRaw.split('\n');

    // Determine indentation from first non-empty line or default '  '
    let indent = '  ';
    for (const ln of innerLines) {
      const m = ln.match(/^(\s+)\S/);
      if (m) {
        indent = m[1];
        break;
      }
    }

    // Strip any existing leading hit statements right after `{`
    let idx = 0;
    let hadNewlineAfterBrace = innerLines.length > 1;
    if (hadNewlineAfterBrace && innerLines[0].trim() === '') {
      idx = 1;
    }
    let strippedCount = 0;
    while (idx < innerLines.length && HIT_STMT_RE.test(innerLines[idx])) {
      idx++;
      strippedCount++;
    }

    if (entries.length === 0 && strippedCount === 0) {
      continue;
    }

    const remainingLines = innerLines.slice(idx);
    let newInner;
    if (entries.length === 0) {
      newInner = (hadNewlineAfterBrace ? '\n' : '') + remainingLines.join('\n');
    } else {
      const hitBlock = hitCalls.map(c => `${indent}${c}`).join('\n');
      if (remainingLines.length === 0 || (remainingLines.length === 1 && remainingLines[0].trim() === '')) {
        const closingIndentMatch = (remainingLines[0] || '').match(/^(\s*)$/);
        const closingIndent = closingIndentMatch ? closingIndentMatch[1] : '';
        newInner = `\n${hitBlock}\n${closingIndent}`;
      } else if (!hadNewlineAfterBrace) {
        newInner = `\n${hitBlock}\n${indent}${remainingLines.join('\n').trim()}\n`;
      } else {
        newInner = `\n${hitBlock}\n${remainingLines.join('\n')}`;
      }
    }

    if (newInner !== innerRaw) {
      edits.push({ start: openBracePos + 1, end: closeBracePos, text: newInner });
    }
  }

  // Compute required va-trace import
  const relToTraceRaw = path.relative(path.dirname(absFile), path.join(kernDir, 'va-trace-113c')).replace(/\\/g, '/');
  const relSpec = (relToTraceRaw.startsWith('.') ? relToTraceRaw : './' + relToTraceRaw) + ext;
  const helperNames = [...neededHelpers].sort();
  const desiredImportLine = helperNames.length > 0
    ? `import { ${helperNames.join(', ')} } from '${relSpec}'${semi}`
    : '';

  if (existingVaTraceImport) {
    const curImportText = existingVaTraceImport.getText(sf);
    if (helperNames.length === 0) {
      let endPos = existingVaTraceImport.getEnd();
      if (orig[endPos] === '\r') endPos++;
      if (orig[endPos] === '\n') endPos++;
      edits.push({ start: existingVaTraceImport.getStart(sf), end: endPos, text: '' });
    } else if (curImportText !== desiredImportLine) {
      edits.push({
        start: existingVaTraceImport.getStart(sf),
        end: existingVaTraceImport.getEnd(),
        text: desiredImportLine,
      });
    }
  } else if (helperNames.length > 0) {
    if (lastImportEnd > 0) {
      edits.push({ start: lastImportEnd, end: lastImportEnd, text: `\n${desiredImportLine}` });
    } else {
      edits.push({ start: 0, end: 0, text: `${desiredImportLine}\n` });
    }
  }

  if (edits.length === 0) continue;

  edits.sort((a, b) => b.start - a.start);
  let next = orig;
  for (const e of edits) {
    next = next.slice(0, e.start) + e.text + next.slice(e.end);
  }

  if (next !== orig) {
    dirtyFiles++;
    if (mode === 'apply') {
      fs.writeFileSync(absFile, next, 'utf8');
    } else {
      console.error(`[instrument-va-trace] Out-of-date instrumentation in ${relFile}`);
    }
  }
}

if (mode === 'check') {
  if (dirtyFiles > 0) {
    console.error(`[instrument-va-trace] CHECK FAILED: ${dirtyFiles} file(s) need --apply`);
    process.exit(1);
  }
  console.log(`[instrument-va-trace] CHECK OK (${instrumentedSyms} instrumented kernel symbols)`);
} else {
  console.log(`[instrument-va-trace] APPLY OK: updated ${dirtyFiles} file(s) (${instrumentedSyms} instrumented kernel symbols)`);
}
"""


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Ensure ported/diff-verified kernel symbols emit va-trace hits."
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--check", action="store_true", help="Exit 1 if any file is uninstrumented")
    group.add_argument("--apply", action="store_true", help="Write VA trace calls in place")
    args = parser.parse_args()

    env = dict(os.environ)
    env["D2W_REPO_ROOT"] = REPO_ROOT
    env["D2W_MODE"] = "apply" if args.apply else "check"
    proc = subprocess.run(["node", "-e", NODE_SCRIPT], cwd=REPO_ROOT, env=env, check=False)
    return proc.returncode


if __name__ == "__main__":
    sys.exit(main())

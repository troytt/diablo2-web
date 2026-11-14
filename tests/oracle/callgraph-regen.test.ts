import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Regen-no-op gate: manifest-113c.json and the generated function-map.md regions must be exactly what
// tools/oracle/callgraph/sync-gates.py derives from the reviewed bindings (KERN_BINDINGS_113C +
// bindings/*.json). This closes the hand-edited-manifest hole: a manifest status that is not backed by a
// validated binding fails here. Never silently skips: the d2oracle venv and the DLLs are required.
const REPO_ROOT = resolve(import.meta.dirname, '../..');
const VENV_PY = join(homedir(), '.local', 'opt', 'd2oracle', 'venv', 'bin', 'python3');
const SYNC = join(REPO_ROOT, 'tools', 'oracle', 'callgraph', 'sync-gates.py');
const D2_DATA_DIR = process.env.D2_DATA_DIR || join(homedir(), 'd2-data');

function runSync(args: string[]): { code: number; out: string } {
  try {
    const out = execFileSync(VENV_PY, [SYNC, ...args], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120_000,
    });
    return { code: 0, out };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { code: err.status ?? -1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

describe('call-graph derived gate files are regenerated, never hand-edited (sync-gates.py)', () => {
  it('requires the d2oracle venv, sync tool and real DLLs (never silently skips)', () => {
    expect(existsSync(VENV_PY), `${VENV_PY} missing`).toBe(true);
    expect(existsSync(SYNC)).toBe(true);
    expect(existsSync(join(D2_DATA_DIR, 'D2Common.dll'))).toBe(true);
    expect(existsSync(join(D2_DATA_DIR, 'D2Game.dll'))).toBe(true);
  });

  it('sync-gates.py --self-test: ratchet, allowlist and row renderer negative controls pass', () => {
    const r = runSync(['--self-test']);
    expect(r.out).toContain('SELF-TEST OK');
    expect(r.code).toBe(0);
  });

  it('sync-gates.py --check: manifest-113c.json and function-map.md are byte-identical to a fresh regeneration', () => {
    const r = runSync(['--check']);
    expect(r.out, r.out).toContain('CHECK OK');
    expect(r.code, r.out).toBe(0);
  }, 180_000);
});

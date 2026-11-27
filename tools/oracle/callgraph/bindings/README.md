# `tools/oracle/callgraph/bindings/` — K1 per-batch closure bindings

`KERN_BINDINGS_113C` in `extract-callgraph.py` is the **frozen K0 list** (its totals are pinned as
`K0_BASE` in `tests/oracle/callgraph.test.ts`). Every K1 binding lives in exactly **one JSON file per
batch** in this directory, so parallel batches never edit a shared Python list, test literal, or doc row.

## File format

`bindings/<batch>.json` (file name `^[A-Za-z0-9][A-Za-z0-9_.-]*\.json$`, e.g. `k1r2-B002.json`) is a
non-empty JSON array, strictly ascending by `va`, of objects with exactly these keys:

```json
[
  {
    "module": "D2Common",
    "va": "0x6FD8C000",
    "name": "DUNGEON_GetLevelIdFromRoom",
    "kernFile": "src/d2kern-113c/common/dungeon.ts",
    "tsSymbol": "DUNGEON_GetLevelIdFromRoom113c",
    "status": "diff-verified",
    "diffEvidence": "tests/oracle/k1/c-B001-dungeon.test.ts (24 real-DLL vectors via fn-emitter)"
  }
]
```

- `va` is a string: `"0x"` + 8 hex digits. All values are non-empty strings; `diffEvidence` is optional
  for `ported` and mandatory for `diff-verified`.
- Validation is identical to the K0 list (`build_verified_kern_registry`): genuine CFG function start,
  inside the closure, `kernFile` under `src/d2kern-113c/` that contains both the exact VA text and
  `tsSymbol`, globally unique `name`, no duplicate `(module, va)` across K0 and all JSON files.
- **Extra JSON-only rule:** a `diff-verified` entry must cite at least one `tests/oracle/**/*.test.ts`
  file that itself contains the exact VA string (e.g. `0x6FD8C000`, case-insensitive). Citation-only
  evidence is rejected.
- `tests/oracle/callgraph.test.ts` re-reads these files and checks every entry against the manifest
  (status, name, kernFile, tsSymbol, diffEvidence) and the totals `K0_BASE + bindings`.
- Promoting or fixing a **K0** entry is an edit to `KERN_BINDINGS_113C` plus a visible, justified edit to
  `K0_BASE` (never a JSON duplicate of a K0 key, which is a hard error).

## Lane workflow

1. Commit kernel code, tests, fixtures and `bindings/<batch>.json` (batch commit(s)).
2. Regenerate the derived files with the sync tool (the **only** writer of `manifest-113c.json` and of the
   `function-map.md` status summary + generated `**ported**` row):

   ```bash
   ~/.local/opt/d2oracle/venv/bin/python3 tools/oracle/callgraph/sync-gates.py          # ~15 s
   ~/.local/opt/d2oracle/venv/bin/python3 tools/oracle/callgraph/sync-gates.py --check  # must exit 0
   ```

3. Commit only `tools/oracle/callgraph/manifest-113c.json` and `docs/oracle/function-map.md` as a separate
   final commit `chore(k1r2): regen derived <batch>`. Do **not** edit `tests/oracle/callgraph.test.ts`.
4. Run the guard tests under the heavy lock:

   ```bash
   flock /tmp/d2w-k1-heavy.lock npx vitest run tests/oracle/callgraph.test.ts tests/oracle/callgraph-regen.test.ts \
     tests/arch/boundaries.test.ts --pool=forks --poolOptions.forks.singleFork
   ```

## Merger workflow

Drop the batch's `chore(k1r2): regen derived` commit, rebase on `origin/main`, run `sync-gates.py`, commit,
then both gates:

```bash
~/.local/opt/d2oracle/venv/bin/python3 tools/oracle/callgraph/sync-gates.py --check
~/.local/opt/d2oracle/venv/bin/python3 tools/oracle/callgraph/sync-gates.py --ratchet origin/main
```

`--ratchet` fails on any status downgrade (diff-verified → ported/unported, ported → unported, which
includes every removed binding), any function leaving the closure, or any deleted `bindings/*.json`.
The only bypass is `--allow <file.json>`, a JSON array of
`{"item": "D2Common:0x6FD87F80" | "bindings/<file>.json", "justification": "<at least 40 chars>"}` where
every entry must match an actual violation (unused entries fail). Paste the justification into the merge
commit message.

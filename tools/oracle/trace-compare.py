#!/usr/bin/env python3
"""Compare oracle traces frame-by-frame over their common frame range.

Usage: trace-compare.py A.ndjson B.ndjson [more...]
Prints the first differing frame (if any) and per-run frame counts.
"""
import json
import sys


def load(p):
  frames = {}
  for line in open(p):
    line = line.strip()
    if not line:
      continue
    try:
      o = json.loads(line)
    except json.JSONDecodeError:
      continue  # truncated final line of a killed run
    if 'frame' not in o:
      continue
    o.pop('initSeed', None)
    o.pop('seedOverride', None)
    frames[o['frame']] = o
  return frames


def main():
  runs = [load(p) for p in sys.argv[1:]]
  common = set(runs[0])
  for r in runs[1:]:
    common &= set(r)
  common = sorted(common)
  print('frames per run:', [len(r) for r in runs], 'common:', len(common))
  for f in common:
    base = runs[0][f]
    for i, r in enumerate(runs[1:], 1):
      if r[f] != base:
        print(f'FIRST DIVERGENCE frame {f} (run 0 vs run {i})')
        for k in sorted(set(base) | set(r[f])):
          if base.get(k) != r[f].get(k):
            a, b = base.get(k), r[f].get(k)
            print(' key', k)
            if isinstance(a, list) and isinstance(b, list):
              ma = {u[0]: u for u in a}
              mb = {u[0]: u for u in b}
              for uid in sorted(set(ma) | set(mb)):
                if ma.get(uid) != mb.get(uid):
                  print('   unit', uid, '\n    A', ma.get(uid), '\n    B', mb.get(uid))
        return 1
  print('IDENTICAL over common frames')
  return 0


if __name__ == '__main__':
  sys.exit(main())

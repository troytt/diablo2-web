#!/usr/bin/env python3
"""Extract the C2S packets actually delivered in an oracle run (trace "in"
key) as scenario `inputs` JSON, so exploratory `oracleSteer` runs can be
frozen into deterministic scenarios that the replica can replay.

Usage: extract-inputs.py trace.ndjson [--until FRAME]
"""
import json
import sys

until = None
if '--until' in sys.argv:
  until = int(sys.argv[sys.argv.index('--until') + 1])
out = []
for line in open(sys.argv[1]):
  try:
    o = json.loads(line)
  except json.JSONDecodeError:
    continue
  f = o.get('frame')
  if f is None or (until is not None and f > until):
    continue
  for _ret, hexs in o.get('in', []):
    out.append({'frame': f, 'c2s': hexs})
print(json.dumps(out))

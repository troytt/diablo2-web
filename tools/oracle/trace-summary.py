#!/usr/bin/env python3
"""Summarize an oracle trace: player position/level timeline and monster/damage counts.
Usage: trace-summary.py trace.ndjson [every_n_frames]"""
import json, sys
p = sys.argv[1]
every = int(sys.argv[2]) if len(sys.argv) > 2 else 100
hdr = None
for line in open(p):
    try:
        o = json.loads(line)
    except Exception:
        continue
    if 'schema' in o:
        hdr = o
        continue
    f = o['frame']
    ndmg = len(o.get('dmg', []))
    if f % every == 0 or ndmg:
        pl = o['t0'][0] if o.get('t0') else None
        lvl_idx = hdr['unitFields'].index('level') if 'level' in hdr['unitFields'] else None
        lv = pl[lvl_idx] if pl and lvl_idx is not None else None
        mons = [m for m in o.get('t1', []) if lvl_idx is None or m[lvl_idx] != 1]
        print(f, 'player', pl[1:5] if pl else None, 'lvl', lv, 'non-town monsters', len(mons), 'dmg', ndmg,
              (o.get('dmg') or [None])[0])

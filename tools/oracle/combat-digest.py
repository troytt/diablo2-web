#!/usr/bin/env python3
"""Combat/buff digest of an oracle trace: states gained/lost per unit,
damage events, deaths, missile counts. Usage: combat-digest.py trace.ndjson"""
import json, sys
prev_st = {}
dmg = 0
maxmis = 0
hdr = None
deaths = []
modes = {}
for line in open(sys.argv[1]):
    try:
        o = json.loads(line)
    except Exception:
        continue
    if 'schema' in o:
        hdr = o; continue
    f = o['frame']
    cur = {(s[0], s[1]): set(s[2:]) for s in o.get('st', [])}
    for k in set(cur) | set(prev_st):
        a, b = prev_st.get(k, set()), cur.get(k, set())
        if a != b:
            print(f'f{f} unit{k} +{sorted(b - a)} -{sorted(a - b)}')
    prev_st = cur
    for d in o.get('dmg', []):
        dmg += 1
        if dmg <= 15:
            print(f'f{f} dmg att{d["att"]} def{d["def"]} raw{d["raw"][:12]}')
    maxmis = max(maxmis, len(o.get('t3', [])))
    for m in o.get('t1', []):
        if m[2] == 12 and modes.get(m[0]) != 12:
            deaths.append((f, m[0], m[1]))
        modes[m[0]] = m[2]
print('damage events', dmg, 'max missiles', maxmis, 'deaths', deaths[:20])

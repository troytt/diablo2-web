#!/usr/bin/env python3
"""Author a .d2s fixture with the ORIGINAL game: start from a level-1 save,
raise experience with the oracle `setexp` op (original PLAYER_LevelUp), then
spend skill and stat points with genuine C2S 0x3B AddSkill / 0x3A AddStat
packets (the server validates prerequisites and level requirements), and
finally Save & Exit through the in-game menu so the game writes the .d2s.

Usage: author-save.py <spec.json> <out.d2s>
spec: {"base": "tests/fixtures/oracle/saves/<l1>.d2s", "exp": N,
       "skills": [[skillId, points], ...], "stats": [[statId, points], ...]}
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))

spec = json.load(open(sys.argv[1]))
out = os.path.abspath(sys.argv[2])
inputs = [
    {'frame': int(item['frame']), 'c2s': str(item['c2s'])}
    for item in spec.get('inputs', [])
]
frame = max([80] + [item['frame'] + 10 for item in inputs])
for sid, pts in spec.get('skills', []):
  for _ in range(pts):
    inputs.append({'frame': frame, 'c2s': '3b' + int(sid).to_bytes(2, 'little').hex()})
    frame += 2
for st, pts in spec.get('stats', []):
  for _ in range(pts):
    inputs.append({'frame': frame, 'c2s': '3a' + int(st).to_bytes(2, 'little').hex()})
    frame += 2
for c2s_hex in spec.get('c2s', []):
  inputs.append({'frame': frame, 'c2s': str(c2s_hex).replace(' ', '').lower()})
  frame += 4
unequip = [int(s) for s in spec.get('unequip', [])]
oracle_equip = []
for idx, (code, bodyloc, quality, ilvl) in enumerate(spec.get('equip', [])):
  if idx < len(unequip):
    inputs.append({'frame': frame, 'c2s': '1c' + unequip[idx].to_bytes(2, 'little').hex()})
    frame += 2
  frame += 2
  oracle_equip.append([frame, str(code), int(bodyloc), int(quality), int(ilvl)])
  frame += 2
inputs.sort(key=lambda item: item['frame'])
game_secs = (frame + 100) // 25 + 4

work = tempfile.mkdtemp(prefix='author-save-')
menu = os.path.join(work, 'menu.txt')
with open(menu, 'w') as f:
  f.write(open(os.path.join(HERE, 'menus', 'sp-first-char.txt')).read())
  # In game (640x480): Esc menu, "Save and Exit Game" is the 2nd item.
  close_dlg = 'key Escape\nwait 800\n' if spec.get('closeDialogBeforeExit') else ''
  f.write(f'wait {game_secs * 1000 + 6000}\n{close_dlg}key Escape\nwait 1500\n'
          'click 320 200\nwait 6000\ndone\n')
scn = {
    'name': 'author-save', 'seed': 12345, 'save': spec['base'], 'difficulty': 0,
    'frames': 100000, 'inputs': inputs, 'oracleMenu': menu,
    'oracleSetExp': [60, int(spec['exp'])],
}
if 'gold' in spec:
  scn['oracleSetGold'] = [62, int(spec['gold'])]
if oracle_equip:
  scn['oracleEquip'] = oracle_equip
scn_path = os.path.join(work, 'scenario.json')
json.dump(scn, open(scn_path, 'w'))
trace = os.path.join(work, 'trace.ndjson')
subprocess.run([os.path.join(HERE, 'run-oracle-scenario.sh'), scn_path, trace],
               cwd=REPO, check=False)
saved = os.path.join(trace + '.d', 'save', 'Oracle.d2s')
if not os.path.exists(saved) or os.path.getsize(saved) < 400:
  sys.exit(f'no full save produced (see {trace}.d)')
shutil.copy(saved, out)
print('wrote', out, os.path.getsize(out), 'bytes; work dir', work)

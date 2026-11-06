#!/usr/bin/env python3
"""Create a level-1 character with the ORIGINAL game's character-creation UI
and save it as a .d2s fixture (the game writes the 335-byte creation header).

Usage: create-char.py <class> <out.d2s>
class: amazon|assassin|necromancer|barbarian|paladin|sorceress|druid
The character is always named "Oracle" (single save slot per run).
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
# Hero figures on the 800x600 "Select Hero Class" screen (left to right).
CLASS_X = {'amazon': 94, 'assassin': 200, 'necromancer': 300, 'barbarian': 400,
           'paladin': 516, 'sorceress': 610, 'druid': 710}

cls, out = sys.argv[1], os.path.abspath(sys.argv[2])
work = tempfile.mkdtemp(prefix='create-char-')
menu = os.path.join(work, 'menu.txt')
with open(menu, 'w') as f:
  f.write(f'''# Main menu -> Single Player (no saves -> class select) -> class -> name -> OK
wait 10000
move 400 321
wait 500
click 400 321
wait 3000
click {CLASS_X[cls]} 318
wait 2500
text Oracle
wait 800
click 670 568
wait 12000
key Escape
wait 1500
click 320 200
wait 6000
done
''')
# No ORACLE_SAVE: run-oracle.sh starts with an empty Save directory.
scn = {'frames': 100000, 'seed': 12345, 'inputs': []}
env = dict(os.environ)
env.pop('ORACLE_SAVE', None)
scn_txt = os.path.join(work, 'scenario.txt')
open(scn_txt, 'w').write('frames 100000\n')
env['ORACLE_SCENARIO'] = scn_txt
subprocess.run([os.path.join(HERE, 'run-oracle.sh'), menu, work, '90', '-w', '-ns',
                '-seed', '12345'], cwd=REPO, env=env, check=False)
saved = os.path.join(work, 'save', 'Oracle.d2s')
if not os.path.exists(saved):
  sys.exit(f'no save produced (see {work})')
shutil.copy(saved, out)
print('wrote', out, os.path.getsize(out), 'bytes; work dir', work)

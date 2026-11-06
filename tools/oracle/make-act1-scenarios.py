#!/usr/bin/env python3
"""Generate the Act 1 coverage scenarios (tests/fixtures/oracle/scenarios/a1c-*.json).

Seed 12345 as in the P5.2 scenarios. The westward route out of the Rogue
Encampment was frozen from an `oracleSteer` exploration run (steer -10,0 every
20 frames from frame 640, tools/oracle/extract-inputs.py --until 700). On that
route the original game activates a Blood Moor room holding four `fallen1`
(MonStats 19, AI `Fallen`, units 12..15). Further west (player x ~5525) the
exploration run also met `quillrat1` (63, AI `QuillRat`); that needs a longer route.

C2S formats (src/netproto/d2gs/c2s/skills.ts):
  0x06 LeftSkillOnUnit u32 type, u32 id     0x03 RunToLocation u16 x, u16 y
"""
import json
import os
import struct

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
SCN = os.path.join(REPO, 'tests', 'fixtures', 'oracle', 'scenarios')

# Rogue Encampment exit route shared with a1-bloodmoor-melee (frames < 620).
route = [i for i in json.load(open(os.path.join(SCN, 'a1-bloodmoor-melee.json')))['inputs']
         if i['frame'] < 620]
# Frozen steer packets (RunToLocation, west) from the exploration run.
WEST = [(640, 0x1616, 0x16CD), (660, 0x160C, 0x16CD), (680, 0x1602, 0x16CD), (700, 0x15F8, 0x16CD)]


def run(x, y):
  return '03' + struct.pack('<HH', x, y).hex()


def l_unit(uid, t=1):
  return '06' + struct.pack('<II', t, uid).hex()


def every(start, stop, step, pkt, note):
  return [{'frame': f, 'c2s': pkt, 'note': note} for f in range(start, stop, step)]


def scenario(name, save, frames, desc, inputs):
  inputs = route + sorted(inputs, key=lambda i: i['frame'])
  seen = set()
  for i in inputs:  # one packet per frame keeps the ordering unambiguous
    while i['frame'] in seen:
      i['frame'] += 1
    seen.add(i['frame'])
  inputs.sort(key=lambda i: i['frame'])
  s = {'name': name, 'description': desc, 'seed': 12345,
       'save': f'tests/fixtures/oracle/saves/{save}.d2s', 'difficulty': 0,
       'frames': frames, 'inputs': inputs}
  with open(os.path.join(SCN, f'{name}.json'), 'w') as f:
    json.dump(s, f, indent=1)
  print('wrote', name, len(inputs), 'inputs')


scenario('a1c-bloodmoor-fallen', 'a1-barbarian-l1', 2000,
         'Barbarian L1 runs west into Blood Moor and melees the Fallen group (MonStats 19, AI '
         'Fallen, units 12..15): kills trigger the Fallen flee reaction of the survivors.', [
             *[{'frame': f, 'c2s': run(x, y), 'note': 'run west (frozen steer)'} for f, x, y in WEST],
             *every(720, 1000, 15, l_unit(12), 'attack Fallen #12'),
             *every(1000, 1330, 15, l_unit(13), 'attack Fallen #13'),
             *every(1330, 1660, 15, l_unit(14), 'attack Fallen #14'),
             *every(1660, 1990, 15, l_unit(15), 'attack Fallen #15'),
         ])

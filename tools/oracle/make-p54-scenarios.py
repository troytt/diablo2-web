#!/usr/bin/env python3
"""Generate the P5.4 client-display capture scenarios (tests/fixtures/oracle/scenarios/p54-*.json).

Same seed, saves and route out of the Rogue Encampment as the P5.2 scenarios
(tools/oracle/make-p52-scenarios.py; route = a1-bloodmoor-melee.json inputs
before frame 620). Each scenario adds buff / aura selections and casts, and a
"captures" list of [frame, label]: at the end of each frame the original-game
hook (tools/oracle/hook/clientui.dll.c) dumps what the D2Client displays, and
tools/oracle/lib/client-ui.ts reads the TS client at the same frame.

C2S formats (src/netproto/d2gs/c2s/skills.ts):
  0x3C SelectSkill u16 skill, u8 0, u8 hand (0x80 left / 0x00 right), u32 item (-1)
  0x0C RightSkillOnLocation u16 x, u16 y
"""
import json
import os
import struct

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
SCN = os.path.join(REPO, 'tests', 'fixtures', 'oracle', 'scenarios')
route = [i for i in json.load(open(os.path.join(SCN, 'a1-bloodmoor-melee.json')))['inputs']
         if i['frame'] < 620]
PX, PY = 5664, 5837  # where the route ends (frame ~300)


def sel(skill, left=False):
  return '3c' + struct.pack('<HBB', skill, 0, 0x80 if left else 0).hex() + 'ffffffff'


def r_loc(x, y):
  return '0c' + struct.pack('<HH', x, y).hex()


def scenario(name, save, desc, inputs, captures):
  inputs = route + sorted(inputs, key=lambda i: i['frame'])
  s = {'name': name, 'description': desc, 'seed': 12345,
       'save': f'tests/fixtures/oracle/saves/{save}.d2s', 'difficulty': 0,
       'frames': max(f for f, _ in captures), 'inputs': inputs, 'captures': captures}
  with open(os.path.join(SCN, f'{name}.json'), 'w') as f:
    json.dump(s, f, indent=1)
  print('wrote', name, len(inputs), 'inputs', len(captures), 'captures')


scenario('p54-barbarian-buffs', 'barbarian-l40-warcries',
         'Barbarian L40 in the Blood Moor: character sheet before and after Battle Orders, '
         'Battle Command and Shout (max life/mana/stamina, defense, skill levels).', [
             {'frame': 620, 'c2s': sel(149), 'note': 'select Battle Orders (right)'},
             {'frame': 630, 'c2s': r_loc(PX, PY), 'note': 'cast BO on self'},
             {'frame': 700, 'c2s': sel(155), 'note': 'select Battle Command'},
             {'frame': 710, 'c2s': r_loc(PX, PY), 'note': 'cast BC'},
             {'frame': 780, 'c2s': sel(138), 'note': 'select Shout'},
             {'frame': 790, 'c2s': r_loc(PX, PY), 'note': 'cast Shout'},
         ], [[600, 'field'], [880, 'buffs']])

scenario('p54-paladin-auras', 'paladin-l40-auras',
         'Paladin L40 in the Blood Moor: character sheet with Concentration, then Fanaticism '
         '(aura damage/attack-rating modifiers in the attack blocks).', [
             {'frame': 620, 'c2s': sel(113), 'note': 'select Concentration (right aura)'},
             {'frame': 760, 'c2s': sel(122), 'note': 'select Fanaticism'},
         ], [[700, 'concentration'], [840, 'fanaticism']])

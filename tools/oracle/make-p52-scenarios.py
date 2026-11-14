#!/usr/bin/env python3
"""Generate the P5.2 combat/buff scenarios (tests/fixtures/oracle/scenarios/p52-*.json).

All scenarios use seed 12345, so the map, the route out of the Rogue
Encampment (frozen from an oracle steer run, see a1-bloodmoor-melee.json) and
the first Blood Moor zombies (unit ids 9, 10, 11 near (5664,5792), (5661,5795),
(5639,5784)) are identical for every class. Saves are level-40 characters
authored by the original game (tools/oracle/author-save.py).

C2S formats (src/netproto/d2gs/c2s/skills.ts):
  0x06 LeftSkillOnUnit  u32 type, u32 id      0x0D RightSkillOnUnit u32 type, u32 id
  0x0C RightSkillOnLocation u16 x, u16 y      0x03 RunToLocation u16 x, u16 y
  0x3C SelectSkill u16 skill, u8 0, u8 hand (0x80 left / 0x00 right), u32 item (-1)
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


def r_unit(uid, t=1):
  return '0d' + struct.pack('<II', t, uid).hex()


def l_unit(uid, t=1):
  return '06' + struct.pack('<II', t, uid).hex()


def run(x, y):
  return '03' + struct.pack('<HH', x, y).hex()


def every(start, stop, step, pkt, note):
  return [{'frame': f, 'c2s': pkt, 'note': note} for f in range(start, stop, step)]


def scenario(name, save, frames, desc, inputs):
  inputs = route + sorted(inputs, key=lambda i: i['frame'])
  frames_seen = set()
  for i in inputs:  # one packet per frame keeps the ordering unambiguous
    while i['frame'] in frames_seen:
      i['frame'] += 1
    frames_seen.add(i['frame'])
  inputs.sort(key=lambda i: i['frame'])
  s = {'name': name, 'description': desc, 'seed': 12345,
       'save': f'tests/fixtures/oracle/saves/{save}.d2s', 'difficulty': 0,
       'frames': frames, 'inputs': inputs}
  with open(os.path.join(SCN, f'{name}.json'), 'w') as f:
    json.dump(s, f, indent=1)
  print('wrote', name, len(inputs), 'inputs')


scenario('p52-barbarian-warcries', 'barbarian-l40-warcries', 1600,
         'Barbarian L40: Battle Orders, Battle Command, Shout on self (state/stat '
         'buffs, durations), then War Cry stuns and melee on zombie #10.', [
             {'frame': 620, 'c2s': sel(149), 'note': 'select Battle Orders (right)'},
             {'frame': 630, 'c2s': r_loc(PX, PY), 'note': 'cast BO on self'},
             {'frame': 700, 'c2s': sel(155), 'note': 'select Battle Command'},
             {'frame': 710, 'c2s': r_loc(PX, PY), 'note': 'cast BC'},
             {'frame': 780, 'c2s': sel(138), 'note': 'select Shout'},
             {'frame': 790, 'c2s': r_loc(PX, PY), 'note': 'cast Shout'},
             {'frame': 850, 'c2s': run(5662, 5800), 'note': 'run to the zombies'},
             {'frame': 900, 'c2s': sel(154), 'note': 'select War Cry'},
             *every(910, 1100, 40, r_loc(5662, 5800), 'cast War Cry'),
             *every(1100, 1500, 20, l_unit(10), 'attack zombie #10'),
         ])

scenario('p52-paladin-auras', 'paladin-l40-auras', 1700,
         'Paladin L40: Concentration aura while attacking zombie #10, then '
         'Fanaticism while attacking zombie #9 (aura state, stat routing, damage).', [
             {'frame': 620, 'c2s': sel(113), 'note': 'select Concentration (right aura)'},
             *every(640, 1100, 20, l_unit(10), 'attack zombie #10'),
             {'frame': 1100, 'c2s': sel(122), 'note': 'select Fanaticism'},
             *every(1120, 1600, 20, l_unit(9), 'attack zombie #9'),
         ])

scenario('p52-amazon-defense', 'amazon-l40-passives', 1800,
         'Amazon L40 (Dodge/Avoid/Evade, Critical Strike): stands next to the '
         'zombies to be attacked, then attacks zombie #10 (block/dodge/avoid and '
         'critical-strike rolls).', [
             {'frame': 620, 'c2s': run(5662, 5800), 'note': 'run next to the zombies'},
             *every(1200, 1750, 20, l_unit(10), 'attack zombie #10'),
         ])

scenario('p52-sorceress-elemental', 'sorceress-l40-elemental', 1800,
         'Sorceress L40: Fire Ball, Chain Lightning, Frozen Orb, Glacial Spike '
         '(missiles, synergies, resistances, cold length/freeze).', [
             {'frame': 620, 'c2s': sel(47), 'note': 'select Fire Ball'},
             *every(630, 900, 30, r_unit(9), 'Fire Ball zombie #9'),
             {'frame': 900, 'c2s': sel(53), 'note': 'select Chain Lightning'},
             *every(910, 1150, 30, r_unit(10), 'Chain Lightning zombie #10'),
             {'frame': 1150, 'c2s': sel(64), 'note': 'select Frozen Orb'},
             *every(1160, 1400, 40, r_loc(5650, 5790), 'Frozen Orb at the zombies'),
             {'frame': 1400, 'c2s': sel(55), 'note': 'select Glacial Spike'},
             *every(1410, 1650, 30, r_unit(11), 'Glacial Spike zombie #11'),
         ])

scenario('p52-necromancer-curses', 'necromancer-l40-curses-summons', 2000,
         'Necromancer L40: Amplify Damage, Decrepify, Lower Resist, Weaken on the '
         'zombies (curse states, exclusivity, durations), melee kill, Raise Skeleton '
         'from the corpse (summon stats).', [
             {'frame': 620, 'c2s': sel(66), 'note': 'select Amplify Damage'},
             {'frame': 630, 'c2s': r_unit(10), 'note': 'AD zombie #10'},
             {'frame': 680, 'c2s': sel(87), 'note': 'select Decrepify'},
             {'frame': 690, 'c2s': r_unit(9), 'note': 'Decrepify zombie #9'},
             {'frame': 740, 'c2s': sel(91), 'note': 'select Lower Resist'},
             {'frame': 750, 'c2s': r_unit(11), 'note': 'Lower Resist zombie #11'},
             {'frame': 800, 'c2s': sel(72), 'note': 'select Weaken'},
             {'frame': 810, 'c2s': r_unit(10), 'note': 'Weaken zombie #10 (replaces AD)'},
             *every(860, 1500, 20, l_unit(10), 'attack zombie #10'),
             {'frame': 1500, 'c2s': sel(70), 'note': 'select Raise Skeleton'},
             *every(1510, 1700, 40, r_unit(10), 'Raise Skeleton from corpse #10'),
         ])

scenario('p52-necromancer-poison-golem', 'necromancer-l40-poison-golem', 1800,
         'Necromancer L40: Clay Golem summon, Poison Nova next to the zombies '
         '(poison DoT state/duration, per-frame damage), Poison Explosion.', [
             {'frame': 620, 'c2s': sel(75), 'note': 'select Clay Golem'},
             {'frame': 630, 'c2s': r_loc(PX, PY - 6), 'note': 'summon Clay Golem'},
             {'frame': 700, 'c2s': run(5662, 5806), 'note': 'run next to the zombies'},
             {'frame': 820, 'c2s': sel(92), 'note': 'select Poison Nova'},
             *every(830, 1100, 60, r_loc(5662, 5806), 'cast Poison Nova'),
         ])

scenario('p52-sorceress-fire-dot', 'sorceress-l40-fire-dot', 1800,
         'Sorceress L40: Fire Wall on the zombies (burning ground DoT, missile '
         'lifetime), then Inferno on zombie #11.', [
             {'frame': 620, 'c2s': sel(51), 'note': 'select Fire Wall'},
             *every(630, 900, 60, r_loc(5662, 5794), 'Fire Wall at the zombies'),
             {'frame': 900, 'c2s': sel(41), 'note': 'select Inferno'},
             *every(910, 1300, 20, r_unit(11), 'Inferno zombie #11'),
         ])

scenario('p52-amazon-valkyrie', 'amazon-l40-passives', 1500,
         'Amazon L40: Valkyrie summon (MonEquip roll, summon stats scaled by skill '
         'level) fighting the zombies.', [
             {'frame': 620, 'c2s': sel(32), 'note': 'select Valkyrie'},
             {'frame': 630, 'c2s': r_loc(PX, PY - 8), 'note': 'summon Valkyrie'},
             {'frame': 700, 'c2s': run(5662, 5806), 'note': 'run towards the zombies'},
         ])

scenario('p52-item-defense', 'paladin-item-defense', 1600,
         'Paladin L70 equipped with Howltusk (ATD 3, MDR 2, 35% Damage to Mana), '
         "Hwanin's Refuge (10% CtC L3 Static Field When Struck, +100 Life), "
         'String of Ears (15% DR, MDR 10), Goblin Toe (DR 1, MDR 1), Hellmouth '
         "(Fire Absorb +15), and Nord's Tenderizer (Cold Absorb 8%): takes zombie "
         'melee hits testing DR/%DR, Damage to Mana, ATD, armor durability, '
         'CtC Static Field When Struck, and Thorns aura reflect.', [
             {'frame': 620, 'c2s': run(5662, 5793), 'note': 'run to zombies #9 and #10'},
             *[
                 {
                     'frame': f,
                     'c2s': run(5664, 5796) if ((f - 656) // 6) % 2 == 1 else run(5661, 5793),
                     'note': 'pace near zombies #9/#10 (DR/%DR + Damage to Mana + ATD + CtC rolls)',
                 }
                 for f in range(656, 971, 6)
             ],
             {'frame': 980, 'c2s': run(5642, 5786), 'note': 'lure zombie #11 without crossing western room boundary'},
             *[
                 {
                     'frame': f,
                     'c2s': run(5645, 5787) if ((f - 1004) // 6) % 2 == 1 else run(5642, 5786),
                     'note': 'pace near zombie #11 (ATD + CtC rolls)',
                 }
                 for f in range(1004, 1095, 6)
             ],
             {'frame': 1099, 'c2s': sel(103), 'note': 'select Thorns aura (right)'},
             *[
                 {
                     'frame': f,
                     'c2s': run(5645, 5787) if ((f - 1004) // 6) % 2 == 1 else run(5642, 5786),
                     'note': 'pace near zombie #11 with Thorns active (ATD + Thorns)',
                 }
                 for f in range(1100, 1593, 6)
             ],
         ])

scenario('p52-paladin-merc-aura', 'paladin-l40-merc-aura', 1700,
         'Paladin L40 + hired Act 1 Rogue Scout: Concentration radial party aura '
         'onto mercenary in Blood Moor combat, then switch to Fanaticism.', [
             {'frame': 620, 'c2s': sel(113), 'note': 'select Concentration (right aura)'},
             {'frame': 660, 'c2s': run(5662, 5806), 'note': 'run next to the zombies'},
             *every(740, 1120, 20, l_unit(11), 'attack zombie #11'),
             {'frame': 1120, 'c2s': sel(122), 'note': 'select Fanaticism (right aura)'},
             *every(1140, 1620, 20, l_unit(10), 'attack zombie #10'),
         ])

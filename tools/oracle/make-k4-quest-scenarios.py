#!/usr/bin/env python3
"""Generate the K4 Act 1-5 deterministic quest scenarios, .d2s fixtures, and
optional headless 1.13c Wine golden traces + F2 memory snapshots.

Usage:
  python3 tools/oracle/make-k4-quest-scenarios.py [--record]

Environment overrides (portable, no hardcoded machine paths):
  D2_ORACLE_ROOT   Path to headless 1.13c Wine/DLL bundle (default: ~/.local/opt/d2oracle)
"""
import argparse
import gzip
import hashlib
import io
import json
import os
import shutil
import struct
import subprocess
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
SAVES_DIR = os.path.join(REPO, 'tests', 'fixtures', 'oracle', 'saves')
SCN_DIR = os.path.join(REPO, 'tests', 'fixtures', 'oracle', 'scenarios')
K4_DIR = os.path.join(REPO, 'tests', 'fixtures', 'oracle', 'k4')
BASE_SAVE = os.path.join(SAVES_DIR, 'paladin-l40-auras.d2s')

STAT_IDS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 39, 41, 43, 45]

# D2Game.dll 0x6FD0BB00 Woo! act-unlock words required to spawn in Acts 1..5.
ACT_UNLOCK_WORDS = {
    0: {},
    1: {6: 0x2001, 7: 0x0001},
    2: {6: 0x2001, 7: 0x0001, 14: 0x2001, 15: 0x0001},
    3: {6: 0x2001, 7: 0x0001, 14: 0x2001, 15: 0x0001, 22: 0x2001, 23: 0x0001},
    4: {
        6: 0x2001,
        7: 0x0001,
        14: 0x2001,
        15: 0x0001,
        22: 0x2001,
        23: 0x0001,
        26: 0x2001,
        28: 0x2001,
    },
}


def fix_d2s_checksum(buf: bytearray) -> bytes:
  struct.pack_into('<I', buf, 0x08, len(buf))
  struct.pack_into('<I', buf, 0x0C, 0)
  csum = 0
  for b in buf:
    csum = (((csum << 1) | (csum >> 31)) + b) & 0xFFFFFFFF
  struct.pack_into('<I', buf, 0x0C, csum)
  return bytes(buf)


def make_compact_jm(code4: str, x: int, y: int, flags: int = 0x00A20010) -> bytes:
  """Encode a 14-byte v101 compact inventory JM item (e.g. 'ass ', 'j34 ')."""
  if len(code4) != 4:
    raise ValueError(f'item code must be 4 chars: {code4!r}')
  val = (
      (flags & 0xFFFFFFFF)
      | ((101 & 0x3FF) << 32)
      | ((0 & 0x7) << 42)
      | ((0 & 0xF) << 45)
      | ((x & 0xF) << 49)
      | ((y & 0xF) << 53)
      | ((1 & 0x7) << 57)
  )
  for k, ch in enumerate(code4):
    val |= (ord(ch) & 0xFF) << (60 + k * 8)
  return b'JM' + val.to_bytes(12, 'little')


def build_quest_save(act: int, quest_words: dict, extra_compact_items=()) -> bytes:
  with open(BASE_SAVE, 'rb') as f:
    raw = bytearray(f.read())
  raw[0xA8] = 0x80 | act
  merged = {**ACT_UNLOCK_WORDS[act], **quest_words}
  for widx, wval in merged.items():
    struct.pack_into('<H', raw, 0x159 + widx * 2, wval)
  if extra_compact_items:
    cnt = struct.unpack_from('<H', raw, 0x34C)[0]
    struct.pack_into('<H', raw, 0x34C, cnt + len(extra_compact_items))
    raw = raw[:0x3D2] + b''.join(extra_compact_items) + raw[0x3D2:]
  return fix_d2s_checksum(raw)


def c2s_run(x: int, y: int) -> str:
  return '03' + struct.pack('<HH', x, y).hex()


def c2s_interact(uid: int, unit_type: int = 1) -> str:
  return '13' + struct.pack('<II', unit_type, uid).hex()


def c2s_npc_init(uid: int, unit_type: int = 1) -> str:
  return '2f' + struct.pack('<II', unit_type, uid).hex()


def c2s_npc_cancel(uid: int, unit_type: int = 1) -> str:
  return '30' + struct.pack('<II', unit_type, uid).hex()


def c2s_quest_msg(npc_uid: int, scroll_id: int) -> str:
  return '31' + struct.pack('<IHxx', npc_uid, scroll_id).hex()


def c2s_use_item(item_uid: int, x: int, y: int) -> str:
  return '20' + struct.pack('<III', item_uid, x, y).hex()


def gzip_deterministic(data: bytes) -> bytes:
  buf = io.BytesIO()
  with gzip.GzipFile(filename='', mode='wb', fileobj=buf, compresslevel=9, mtime=0) as gz:
    gz.write(data)
  return buf.getvalue()


SCENARIO_SPECS = [
    {
        'name': 'k4-act1-quest',
        'act': 0,
        'quest_words': {1: 0x0002},
        'extra_items': [],
        'frames': 160,
        'description': (
            'Act 1 Quest 1 (Den of Evil, word 1 = 0x0002 QFLAG_REWARDPENDING): '
            'Paladin L40 runs from Rogue Encampment spawn (5653, 5918) to Akara '
            '(unit #5, hcIdx 148), completes 0x13/0x2F/0x31 (wScrollId 0x004C) / '
            '0x30 turn-in, and receives +1 STAT_NEWSKILLS (stat 5: 12 -> 13).'
        ),
        'inputs': [
            {'frame': 10, 'c2s': c2s_run(5668, 5918), 'note': 'run east past Rogue campfire'},
            {'frame': 25, 'c2s': c2s_run(5684, 5918), 'note': 'continue east toward Akara tent'},
            {'frame': 40, 'c2s': c2s_run(5694, 5912), 'note': 'angle north-east around tent post'},
            {'frame': 55, 'c2s': c2s_run(5706, 5908), 'note': 'approach Akara clearing'},
            {'frame': 70, 'c2s': c2s_run(5711, 5898), 'note': 'step within melee range of Akara (#5)'},
            {'frame': 100, 'c2s': c2s_interact(5), 'note': 'C2S 0x13 Interact Akara (#5)'},
            {'frame': 106, 'c2s': c2s_npc_init(5), 'note': 'C2S 0x2F NpcInit Akara (#5)'},
            {'frame': 110, 'c2s': c2s_quest_msg(5, 0x004C), 'note': 'C2S 0x31 A1Q1 Den of Evil reward scroll (0x004C -> +1 skill)'},
            {'frame': 114, 'c2s': c2s_npc_cancel(5), 'note': 'C2S 0x30 NpcCancel Akara (#5)'},
        ],
    },
    {
        'name': 'k4-act2-quest',
        'act': 1,
        'quest_words': {9: 0x2021},
        'extra_items': [make_compact_jm('ass ', 0, 0)],
        'frames': 140,
        'description': (
            "Act 2 Quest 1 (Radament's Lair, word 9 = 0x2021 with QFLAG_CUSTOM5 "
            "armed + Book of Skill 'ass ' item #9): Paladin L40 runs from Lut "
            'Gholein spawn (5153, 5203) to Jerhyn (unit #1, hcIdx 201), executes '
            '0x13/0x2F/0x31 (wScrollId 0x00FD) / 0x30 dialog, and consumes Book '
            'of Skill via C2S 0x20 (+1 STAT_NEWSKILLS, stat 5: 12 -> 13).'
        ),
        'inputs': [
            {'frame': 10, 'c2s': c2s_run(5148, 5195), 'note': 'run to Jerhyn (#1) at palace entrance'},
            {'frame': 40, 'c2s': c2s_interact(1), 'note': 'C2S 0x13 Interact Jerhyn (#1)'},
            {'frame': 44, 'c2s': c2s_npc_init(1), 'note': 'C2S 0x2F NpcInit Jerhyn (#1)'},
            {'frame': 48, 'c2s': c2s_quest_msg(1, 0x00FD), 'note': 'C2S 0x31 Act 2 Jerhyn quest greeting scroll (0x00FD)'},
            {'frame': 52, 'c2s': c2s_npc_cancel(1), 'note': 'C2S 0x30 NpcCancel Jerhyn (#1)'},
            {'frame': 64, 'c2s': c2s_use_item(9, 5148, 5195), 'note': "C2S 0x20 UseItem Book of Skill ('ass ' #9 -> +1 skill)"},
        ],
    },
    {
        'name': 'k4-act3-quest',
        'act': 2,
        'quest_words': {20: 0x0004},
        'extra_items': [make_compact_jm('j34 ', 0, 0)],
        'frames': 130,
        'description': (
            "Act 3 Quest 1 (The Golden Bird, word 20 = 0x0004 QFLAG_QSTARTED + "
            "Jade Figurine 'j34 ' item #9): Paladin L40 runs from Kurast Docks "
            'spawn (5118, 5168) to Meshif (unit #3, hcIdx 264) and completes '
            "0x13/0x2F/0x31 (wScrollId 0x0211) / 0x30, exchanging 'j34 ' for "
            "Golden Bird 'g34 ' via QUESTS_CreateItem (advancing game seed gs)."
        ),
        'inputs': [
            {'frame': 10, 'c2s': c2s_run(5113, 5166), 'note': 'step to Meshif (#3) on Kurast Docks pier'},
            {'frame': 34, 'c2s': c2s_interact(3), 'note': 'C2S 0x13 Interact Meshif (#3)'},
            {'frame': 38, 'c2s': c2s_npc_init(3), 'note': 'C2S 0x2F NpcInit Meshif (#3)'},
            {'frame': 42, 'c2s': c2s_quest_msg(3, 0x0211), 'note': "C2S 0x31 A3Q1 Meshif Jade Figurine trade scroll (0x0211 -> mints 'g34 ')"},
            {'frame': 46, 'c2s': c2s_npc_cancel(3), 'note': 'C2S 0x30 NpcCancel Meshif (#3)'},
        ],
    },
    {
        'name': 'k4-act4-quest',
        'act': 3,
        'quest_words': {25: 0x0002},
        'extra_items': [],
        'frames': 140,
        'description': (
            'Act 4 Quest 1 (The Fallen Angel, word 25 = 0x0002 QFLAG_REWARDPENDING): '
            'Paladin L40 runs from Pandemonium Fortress spawn (5048, 5043) to '
            'Tyrael (unit #3, hcIdx 367), completes 0x13/0x2F/0x31 (wScrollId '
            '0x02A4) / 0x30 turn-in, and receives +2 STAT_NEWSKILLS (stat 5: 12 -> 14).'
        ),
        'inputs': [
            {'frame': 10, 'c2s': c2s_run(5024, 5024), 'note': 'run north-west to Tyrael (#3)'},
            {'frame': 64, 'c2s': c2s_interact(3), 'note': 'C2S 0x13 Interact Tyrael (#3)'},
            {'frame': 68, 'c2s': c2s_npc_init(3), 'note': 'C2S 0x2F NpcInit Tyrael (#3)'},
            {'frame': 72, 'c2s': c2s_quest_msg(3, 0x02A4), 'note': 'C2S 0x31 A4Q1 Izual turn-in scroll (0x02A4 -> +2 skills)'},
            {'frame': 76, 'c2s': c2s_npc_cancel(3), 'note': 'C2S 0x30 NpcCancel Tyrael (#3)'},
        ],
    },
    {
        'name': 'k4-act5-quest',
        'act': 4,
        'quest_words': {37: 0x0202},
        'extra_items': [],
        'frames': 140,
        'description': (
            'Act 5 Quest 3 (Prison of Ice, word 37 = 0x0202 QFLAG_REWARDPENDING | '
            'QFLAG_CUSTOM9): Paladin L40 runs from Harrogath spawn (5098, 5023) '
            'to Malah (unit #7, hcIdx 513), completes 0x13/0x2F/0x31 (wScrollId '
            "0x4EA4) / 0x30 to receive Scroll of Resistance ('tr2 ' item #9), "
            'and consumes it via C2S 0x20 (+10 stats 39/41/43/45 all resists).'
        ),
        'inputs': [
            {'frame': 10, 'c2s': c2s_run(5084, 5028), 'note': 'run west-southwest to Malah (#7)'},
            {'frame': 44, 'c2s': c2s_interact(7), 'note': 'C2S 0x13 Interact Malah (#7)'},
            {'frame': 48, 'c2s': c2s_npc_init(7), 'note': 'C2S 0x2F NpcInit Malah (#7)'},
            {'frame': 52, 'c2s': c2s_quest_msg(7, 0x4EA4), 'note': "C2S 0x31 A5Q3 Malah reward scroll (0x4EA4 -> mints 'tr2 ' #9)"},
            {'frame': 56, 'c2s': c2s_npc_cancel(7), 'note': 'C2S 0x30 NpcCancel Malah (#7)'},
            {'frame': 68, 'c2s': c2s_use_item(9, 5084, 5028), 'note': "C2S 0x20 UseItem Scroll of Resistance ('tr2 ' #9 -> +10 all resists)"},
        ],
    },
]


def run_headless_capture(oracle_root: str, save_path: str, scenario_obj: dict) -> tuple[bytes, bytes]:
  wine_bin_dir = os.path.join(oracle_root, 'wine', 'root', 'usr', 'lib', 'x86_64-linux-gnu', 'wine')
  build_dir = os.path.join(oracle_root, 'build')
  pfx = tempfile.mkdtemp(prefix='d2host-k4-')
  try:
    subprocess.run(['cp', '-a', os.path.join(oracle_root, 'wine', 'prefix') + '/.', pfx], check=True)
    c_dir = os.path.join(pfx, 'drive_c')
    c_ora = os.path.join(c_dir, 'oracle')
    c_d2 = os.path.join(c_dir, 'D2')
    os.makedirs(os.path.join(c_ora, 'out'), exist_ok=True)
    os.makedirs(os.path.join(c_d2, 'Save'), exist_ok=True)
    for fn in os.listdir(os.path.join(c_d2, 'Save')):
      os.remove(os.path.join(c_d2, 'Save', fn))
    shutil.copy(save_path, os.path.join(c_d2, 'Save', 'Oracle.d2s'))
    shutil.copy(os.path.join(build_dir, 'd2host-113c.exe'), os.path.join(c_d2, 'd2host-113c.exe'))
    shutil.copy(os.path.join(build_dir, 'd2oracle.dll'), os.path.join(c_d2, 'd2oracle.dll'))

    with open(os.path.join(c_ora, 'scenario.txt'), 'w', encoding='utf-8') as f:
      f.write(f"frames {int(scenario_obj['frames'])}\n")
      f.write(f"states {int(scenario_obj.get('stateCount', 183))}\n")
      f.write('stats ' + ','.join(str(x) for x in scenario_obj['statIds']) + '\n')
      for sf in scenario_obj.get('oracleSnapshot', []):
        f.write(f'snapshot {int(sf)}\n')
      for inp in scenario_obj['inputs']:
        f.write(f"in {int(inp['frame'])} {inp['c2s']}\n")

    env = os.environ.copy()
    env['WINEPREFIX'] = pfx
    env['WINESERVER'] = os.path.join(wine_bin_dir, 'wineserver')
    env['WINELOADER'] = os.path.join(wine_bin_dir, 'wine')
    env['WINEDEBUG'] = '-all'
    env['WINEDLLOVERRIDES'] = 'mscoree,mshtml=;winex11.drv=;winedbg.exe=d'
    env.pop('DISPLAY', None)

    subprocess.run(
        [
            os.path.join(wine_bin_dir, 'wine'),
            'd2host-113c.exe',
            '--seed',
            str(int(scenario_obj['seed'])),
            '--frames',
            str(int(scenario_obj['frames'])),
            '--difficulty',
            str(int(scenario_obj['difficulty'])),
            '--oracle-dll',
            'd2oracle.dll',
        ],
        cwd=c_d2,
        env=env,
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    subprocess.run(
        [os.path.join(wine_bin_dir, 'wineserver'), '-k'],
        env=env,
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    with open(os.path.join(c_ora, 'out', 'trace.ndjson'), 'rb') as ft:
      trace_bytes = ft.read()
    with open(os.path.join(c_ora, 'out', 'snap_2.ndjson'), 'rb') as fs:
      snap_bytes = fs.read()
    return trace_bytes, snap_bytes
  finally:
    shutil.rmtree(pfx, ignore_errors=True)


def main() -> None:
  ap = argparse.ArgumentParser()
  ap.add_argument('--record', action='store_true', help='Capture .oracle.ndjson.gz + .snap-f002.ndjson.gz via Wine d2host-113c.exe')
  args = ap.parse_args()

  os.makedirs(SAVES_DIR, exist_ok=True)
  os.makedirs(SCN_DIR, exist_ok=True)
  os.makedirs(K4_DIR, exist_ok=True)

  oracle_root = os.environ.get(
      'D2_ORACLE_ROOT',
      os.path.join(os.path.expanduser('~'), '.local', 'opt', 'd2oracle'),
  )

  for spec in SCENARIO_SPECS:
    name = spec['name']
    save_rel = f'tests/fixtures/oracle/saves/{name}.d2s'
    save_abs = os.path.join(REPO, save_rel)
    d2s_bytes = build_quest_save(spec['act'], spec['quest_words'], spec['extra_items'])
    with open(save_abs, 'wb') as f:
      f.write(d2s_bytes)

    scenario_obj = {
        'name': name,
        'description': spec['description'],
        'seed': 12345,
        'save': save_rel,
        'difficulty': 0,
        'frames': spec['frames'],
        'statIds': STAT_IDS,
        'oracleSnapshot': [2],
        'inputs': spec['inputs'],
    }
    scn_abs = os.path.join(SCN_DIR, f'{name}.json')
    with open(scn_abs, 'w', encoding='utf-8') as f:
      json.dump(scenario_obj, f, indent=2)
      f.write('\n')

    if args.record:
      trace1, snap1 = run_headless_capture(oracle_root, save_abs, scenario_obj)
      trace2, _ = run_headless_capture(oracle_root, save_abs, scenario_obj)
      if hashlib.sha256(trace1).digest() != hashlib.sha256(trace2).digest():
        raise RuntimeError(f'non-deterministic oracle trace for {name}')
      # Verify every C2S packet returned 0 in D2Game C2S_DispatchPacket.
      rc_list = []
      for line in trace1.decode('utf-8').splitlines():
        if not line.strip():
          continue
        row = json.loads(line)
        for entry in row.get('in', []):
          rc_list.append(entry[0])
      if any(rc != 0 for rc in rc_list) or len(rc_list) != len(spec['inputs']):
        raise RuntimeError(f'{name}: unexpected C2S dispatch return codes {rc_list}')

      golden_gz = gzip_deterministic(trace1)
      snap_gz = gzip_deterministic(snap1)
      with open(os.path.join(K4_DIR, f'{name}.oracle.ndjson.gz'), 'wb') as fg:
        fg.write(golden_gz)
      with open(os.path.join(K4_DIR, f'{name}.snap-f002.ndjson.gz'), 'wb') as fs:
        fs.write(snap_gz)
      print(
          f'recorded {name}: inputs={len(rc_list)} rc={rc_list} '
          f'golden={len(golden_gz)}B snap={len(snap_gz)}B'
      )
    else:
      print(f'wrote {name}.d2s ({len(d2s_bytes)}B) and {name}.json')


if __name__ == '__main__':
  main()

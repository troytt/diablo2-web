#!/usr/bin/env python3
"""Generate and record the [K6] Wave 1 deterministic headless 1.13c DLL scenarios.

Outputs:
  - tools/oracle/k6/scenarios/<name>.json
  - tests/fixtures/oracle/k6/saves/<name>.d2s
  - tests/fixtures/oracle/k6/<name>.oracle.ndjson.gz
  - tests/fixtures/oracle/k6/<name>.snap-f002.ndjson.gz
  - tests/fixtures/oracle/k6/<name>.coverage.ndjson.gz

Environment overrides (portable, zero hardcoded machine paths):
  D2_ORACLE_ROOT   Path to headless 1.13c Wine/DLL bundle (default: ~/.local/opt/d2oracle)

Usage:
  python3 tools/oracle/k6/make-k6-wave1-scenarios.py [--record]
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
REPO = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
SCN_OUT_DIR = os.path.join(HERE, 'scenarios')
K6_FIX_DIR = os.path.join(REPO, 'tests', 'fixtures', 'oracle', 'k6')
K6_SAVES_DIR = os.path.join(K6_FIX_DIR, 'saves')
LEGACY_SAVES_DIR = os.path.join(REPO, 'tests', 'fixtures', 'oracle', 'saves')

STAT_IDS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 39, 41, 43, 45]

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


def make_new_char_d2s(cls_id: int) -> bytes:
    with open(os.path.join(LEGACY_SAVES_DIR, 'a1-barbarian-l1.d2s'), 'rb') as f:
        raw = bytearray(f.read())
    raw[0x28] = cls_id & 0xFF
    return fix_d2s_checksum(raw)


def make_compact_jm(code4: str, x: int, y: int, flags: int = 0x00A20010) -> bytes:
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


def build_paladin_save(act: int, quest_words: dict, extra_compact_items=()) -> bytes:
    with open(os.path.join(LEGACY_SAVES_DIR, 'paladin-l40-auras.d2s'), 'rb') as f:
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


def gzip_deterministic(data: bytes) -> bytes:
    buf = io.BytesIO()
    with gzip.GzipFile(filename='', mode='wb', fileobj=buf, compresslevel=9, mtime=0) as gz:
        gz.write(data)
    return buf.getvalue()


# --- C2S Packet Encoders (1.13c ground-truth sizes & field layouts) ---

def c2s_walk(x: int, y: int) -> str:
    return '01' + struct.pack('<HH', x, y).hex()


def c2s_run(x: int, y: int) -> str:
    return '03' + struct.pack('<HH', x, y).hex()


def c2s_l_loc(x: int, y: int) -> str:
    return '05' + struct.pack('<HH', x, y).hex()


def c2s_l_unit(uid: int, utype: int = 1, shift: bool = False) -> str:
    op = '07' if shift else '06'
    return op + struct.pack('<II', utype, uid).hex()


def c2s_r_loc(x: int, y: int) -> str:
    return '0c' + struct.pack('<HH', x, y).hex()


def c2s_r_unit(uid: int, utype: int = 1, shift: bool = False) -> str:
    op = '0e' if shift else '0d'
    return op + struct.pack('<II', utype, uid).hex()


def c2s_interact(uid: int, utype: int = 1) -> str:
    return '13' + struct.pack('<II', utype, uid).hex()


def c2s_overhead(msg: str) -> str:
    return '140000' + msg.encode('ascii').hex() + '000000'


def c2s_chat(msg: str) -> str:
    return '150100' + msg.encode('ascii').hex() + '000000'


def c2s_pickup(item_id: int, to_cursor: int = 0) -> str:
    return '16' + struct.pack('<III', 4, item_id, to_cursor).hex()


def c2s_drop_cursor(item_id: int) -> str:
    return '17' + struct.pack('<I', item_id).hex()


def c2s_place_buf(item_id: int, x: int, y: int, buf_type: int) -> str:
    return '18' + struct.pack('<IIII', item_id, x, y, buf_type).hex()


def c2s_item_to_cursor(item_id: int) -> str:
    return '19' + struct.pack('<I', item_id).hex()


def c2s_equip(item_id: int, slot: int) -> str:
    return '1a' + struct.pack('<IHH', item_id, slot, 0).hex()


def c2s_unequip(slot: int) -> str:
    return '1c' + struct.pack('<H', slot).hex()


def c2s_swap_body(item_id: int, slot: int) -> str:
    return '1d' + struct.pack('<IHH', item_id, slot, 0).hex()


def c2s_use_item(item_id: int, x: int, y: int) -> str:
    return '20' + struct.pack('<III', item_id, x, y).hex()


def c2s_belt_put(item_id: int, slot: int) -> str:
    return '23' + struct.pack('<II', item_id, slot).hex()


def c2s_belt_remove(item_id: int) -> str:
    return '24' + struct.pack('<I', item_id).hex()


def c2s_belt_use(item_id: int, shift: int = 0) -> str:
    return '26' + struct.pack('<III', item_id, shift, 0).hex()


def c2s_item_to_cube(item_id: int, cube_id: int) -> str:
    return '2a' + struct.pack('<II', item_id, cube_id).hex()


def c2s_npc_init(uid: int, utype: int = 1) -> str:
    return '2f' + struct.pack('<II', utype, uid).hex()


def c2s_npc_cancel(uid: int, utype: int = 1) -> str:
    return '30' + struct.pack('<II', utype, uid).hex()


def c2s_quest_msg(npc_id: int, scroll_id: int) -> str:
    return '31' + struct.pack('<IHH', npc_id, scroll_id, 0).hex()


def c2s_npc_buy(npc_id: int, item_id: int, item_mode: int = 0, gamble: bool = False, shift_fill: bool = False, cost: int = 0) -> str:
    field3 = ((item_mode & 0xFFFF) << 16) | (2 if gamble else 0) | (0x80000000 if shift_fill else 0)
    return '32' + struct.pack('<IIII', npc_id, item_id, field3, cost).hex()


def c2s_npc_sell(npc_id: int, item_id: int, item_mode: int = 0, cost: int = 0) -> str:
    return '33' + struct.pack('<IIII', npc_id, item_id, item_mode & 0xFFFF, cost).hex()


def c2s_npc_repair_all(npc_id: int) -> str:
    return '35' + struct.pack('<IIII', npc_id, 0, 0, 0x80000000).hex()


def c2s_npc_action(action: int, npc_id: int, complement: int = 0) -> str:
    return '38' + struct.pack('<III', action, npc_id, complement).hex()


def c2s_add_stat(stat_id: int, count: int = 1) -> str:
    return '3a' + struct.pack('<BB', stat_id & 0x0F, max(0, min(99, count - 1))).hex()


def c2s_add_skill(skill_id: int) -> str:
    return '3b' + struct.pack('<H', skill_id & 0xFFFF).hex()


def c2s_sel_skill(skill_id: int, left: bool = False, item_id: int = 0xFFFFFFFF) -> str:
    return '3c' + struct.pack('<HBBI', skill_id & 0xFFFF, 0, 0x80 if left else 0x00, item_id & 0xFFFFFFFF).hex()


def c2s_say(phrase_id: int = 25) -> str:
    return '3f' + struct.pack('<H', phrase_id & 0xFFFF).hex()


def c2s_quest_log() -> str:
    return '40'


def c2s_waypoint(wp_uid: int, dest_area: int) -> str:
    return '49' + struct.pack('<II', wp_uid, dest_area).hex()


def c2s_click_button(button_id: int, amount: int = 0) -> str:
    return '4f' + struct.pack('<HHH', button_id & 0xFFFF, (amount >> 16) & 0xFFFF, amount & 0xFFFF).hex()


def c2s_drop_gold(plr_uid: int, amount: int) -> str:
    return '50' + struct.pack('<II', plr_uid, amount).hex()


def c2s_hotkey(slot: int, skill_id: int, left: bool = False) -> str:
    lo = skill_id & 0xFF
    hi = ((skill_id >> 8) & 0x7F) | (0x80 if left else 0x00)
    return '51' + struct.pack('<BBHI', lo, hi, slot & 0x0F, 0xFFFFFFFF).hex()


def c2s_swap_weapons() -> str:
    return '60'


def c2s_item_to_belt(item_id: int) -> str:
    return '63' + struct.pack('<I', item_id).hex()


# Fast deterministic route through Rogue Encampment north gate (x=5664..5666) into Blood Moor (~5662, 5802)
def blood_moor_route(start_frame: int = 42) -> list[dict]:
    pts = [
        (0, 5645, 5906),
        (20, 5652, 5894),
        (40, 5664, 5882),
        (60, 5665, 5879),
        (82, 5666, 5860),
        (104, 5666, 5843),
        (126, 5665, 5827),
        (146, 5664, 5817),
        (164, 5662, 5802),
    ]
    return [{'frame': start_frame + df, 'c2s': c2s_run(x, y), 'note': f'run to ({x},{y})'} for df, x, y in pts]


def build_druid_scenario() -> tuple[bytes, dict]:
    save_bytes = make_new_char_d2s(5)  # Druid
    inputs: list[dict] = [
        {'frame': 3, 'c2s': c2s_add_stat(0, 40), 'note': '+40 Strength'},
        {'frame': 4, 'c2s': c2s_add_stat(1, 80), 'note': '+80 Energy'},
        {'frame': 5, 'c2s': c2s_add_stat(2, 40), 'note': '+40 Dexterity'},
        {'frame': 6, 'c2s': c2s_add_stat(3, 80), 'note': '+80 Vitality'},
    ]
    # Learn all 30 Druid skills in topological prerequisite order (250 Hurricane before 249 Armageddon)
    druid_order = list(range(221, 249)) + [250, 249]
    fr = 7
    for sid in druid_order:
        inputs.append({'frame': fr, 'c2s': c2s_add_skill(sid), 'note': f'learn Druid skill {sid}'})
        fr += 1
    # fr is now 37
    inputs.extend([
        {'frame': 37, 'c2s': c2s_hotkey(0, 245, False), 'note': 'bind Tornado hotkey'},
        {'frame': 38, 'c2s': c2s_swap_weapons(), 'note': 'weapon swap to tab 2'},
        {'frame': 39, 'c2s': c2s_swap_weapons(), 'note': 'weapon swap back to tab 1'},
        {'frame': 40, 'c2s': c2s_sel_skill(221, False), 'note': 'select Raven'},
        {'frame': 41, 'c2s': c2s_r_loc(5653, 5918), 'note': 'summon Raven in town'},
    ])
    inputs.extend(blood_moor_route(48))  # reaches (5662, 5802) around F215 in Blood Moor
    casts = [
        # Summoning tree
        (220, c2s_sel_skill(226, False), 'select Oak Sage'),
        (221, c2s_r_loc(5662, 5802), 'cast Oak Sage'),
        (232, c2s_sel_skill(222, False), 'select Plague Poppy'),
        (233, c2s_r_loc(5660, 5802), 'cast Plague Poppy'),
        (244, c2s_sel_skill(227, False), 'select Summon Spirit Wolf'),
        (245, c2s_r_loc(5664, 5800), 'cast Spirit Wolf'),
        (256, c2s_sel_skill(237, False), 'select Summon Fenris'),
        (257, c2s_r_loc(5663, 5799), 'cast Dire Wolf'),
        (268, c2s_sel_skill(247, False), 'select Summon Grizzly'),
        (269, c2s_r_loc(5662, 5798), 'cast Grizzly'),
        # Elemental tree
        (280, c2s_sel_skill(235, False), 'select Cyclone Armor'),
        (281, c2s_r_loc(5662, 5802), 'cast Cyclone Armor'),
        (292, c2s_sel_skill(250, False), 'select Hurricane'),
        (293, c2s_r_loc(5662, 5802), 'cast Hurricane'),
        (304, c2s_sel_skill(225, False), 'select Firestorm'),
        (305, c2s_r_loc(5661, 5795), 'cast Firestorm toward zombies'),
        (316, c2s_sel_skill(229, False), 'select Molten Boulder'),
        (317, c2s_r_loc(5661, 5795), 'cast Molten Boulder'),
        (330, c2s_sel_skill(234, False), 'select Fissure'),
        (331, c2s_r_loc(5661, 5795), 'cast Fissure under zombies'),
        (344, c2s_sel_skill(240, False), 'select Twister'),
        (345, c2s_r_loc(5661, 5795), 'cast Twister'),
        (356, c2s_sel_skill(245, False), 'select Tornado'),
        (357, c2s_r_loc(5661, 5795), 'cast Tornado'),
        # Shape Shifting tree
        (368, c2s_sel_skill(223, False), 'select Werewolf'),
        (369, c2s_r_loc(5662, 5802), 'shift into Werewolf'),
        (380, c2s_sel_skill(232, True), 'select Feral Rage (left)'),
        (381, c2s_l_unit(10, 1, False), 'Feral Rage attack zombie #10'),
    ]
    for f, pkt, note in casts:
        inputs.append({'frame': f, 'c2s': pkt, 'note': note})

    scn = {
        'name': 'k6-druid-skills',
        'description': (
            'Druid L72 multi-tree scenario: allocates stats (0x3A) and all 30 Druid skills (221..250 via 0x3B), '
            'binds hotkeys (0x51), swaps weapons (0x60), summons Raven/Oak Sage/Plague Poppy/Wolves/Grizzly, '
            'casts Cyclone Armor/Hurricane/Firestorm/Molten Boulder/Fissure/Twister/Tornado, and shifts to Werewolf '
            'with Feral Rage combat in Blood Moor.'
        ),
        'seed': 12345,
        'save': 'tests/fixtures/oracle/k6/saves/k6-druid-skills.d2s',
        'difficulty': 0,
        'frames': 390,
        'statIds': STAT_IDS,
        'oracleSetExp': [2, 350000000],
        'oracleSetGold': [2, 500000],
        'oracleEquip': [
            [2, 'cap', 1, 6, 40],
            [2, 'lbl', 8, 6, 40],
            [2, 'spc', 11, 4, 40],
            [2, 'buc', 12, 4, 40],
        ],
        'oracleSnapshot': [2],
        'inputs': inputs,
    }
    return save_bytes, scn


def build_assassin_scenario() -> tuple[bytes, dict]:
    save_bytes = make_new_char_d2s(6)  # Assassin
    inputs: list[dict] = [
        {'frame': 3, 'c2s': c2s_add_stat(0, 50), 'note': '+50 Strength'},
        {'frame': 4, 'c2s': c2s_add_stat(1, 70), 'note': '+70 Energy'},
        {'frame': 5, 'c2s': c2s_add_stat(2, 50), 'note': '+50 Dexterity'},
        {'frame': 6, 'c2s': c2s_add_stat(3, 70), 'note': '+70 Vitality'},
    ]
    fr = 7
    for sid in range(251, 281):
        inputs.append({'frame': fr, 'c2s': c2s_add_skill(sid), 'note': f'learn Assassin skill {sid}'})
        fr += 1
    inputs.extend([
        {'frame': 37, 'c2s': c2s_sel_skill(258, False), 'note': 'select Burst of Speed'},
        {'frame': 38, 'c2s': c2s_r_loc(5653, 5918), 'note': 'cast Burst of Speed in town'},
        {'frame': 50, 'c2s': c2s_sel_skill(279, False), 'note': 'select Shadow Master'},
        {'frame': 51, 'c2s': c2s_r_loc(5650, 5915), 'note': 'summon Shadow Master'},
    ])
    inputs.extend(blood_moor_route(60))  # faster with Burst of Speed! Reaches Blood Moor zombies by F225
    casts = [
        # Shadow buffs & control
        (228, c2s_sel_skill(278, False), 'select Venom'),
        (229, c2s_r_loc(5662, 5802), 'cast Venom'),
        (240, c2s_sel_skill(277, False), 'select Blade Shield'),
        (241, c2s_r_loc(5662, 5802), 'cast Blade Shield'),
        (252, c2s_sel_skill(264, False), 'select Cloak of Shadows'),
        (253, c2s_r_loc(5661, 5795), 'cast Cloak of Shadows'),
        (265, c2s_sel_skill(273, False), 'select Mind Blast'),
        (266, c2s_r_loc(5661, 5795), 'cast Mind Blast on zombies'),
        # Traps
        (278, c2s_sel_skill(251, False), 'select Fire Blast'),
        (279, c2s_r_loc(5661, 5795), 'throw Fire Blast'),
        (290, c2s_sel_skill(256, False), 'select Shock Web'),
        (291, c2s_r_loc(5661, 5795), 'throw Shock Web'),
        (302, c2s_sel_skill(257, False), 'select Blade Sentinel'),
        (303, c2s_r_loc(5661, 5795), 'throw Blade Sentinel'),
        (314, c2s_sel_skill(262, False), 'select Wake of Fire'),
        (315, c2s_r_loc(5662, 5798), 'lay Wake of Fire trap'),
        (326, c2s_sel_skill(271, False), 'select Lightning Sentry'),
        (327, c2s_r_loc(5660, 5798), 'lay Lightning Sentry trap'),
        (338, c2s_sel_skill(276, False), 'select Death Sentry'),
        (339, c2s_r_loc(5664, 5798), 'lay Death Sentry trap'),
        # Martial Arts charge-up + finisher
        (350, c2s_run(5662, 5796), 'step adjacent to zombie #10'),
        (358, c2s_sel_skill(254, True), 'select Tiger Strike (left)'),
        (359, c2s_l_unit(10, 1, False), 'charge Tiger Strike on #10'),
        (370, c2s_sel_skill(280, True), 'select Phoenix Strike (left)'),
        (371, c2s_l_unit(10, 1, False), 'charge Phoenix Strike on #10'),
        (381, c2s_sel_skill(260, False), 'select Dragon Claw finisher (right)'),
        (382, c2s_r_unit(10, 1, False), 'release charges with Dragon Claw on #10'),
    ]
    for f, pkt, note in casts:
        inputs.append({'frame': f, 'c2s': pkt, 'note': note})

    scn = {
        'name': 'k6-assassin-skills',
        'description': (
            'Assassin L72 dual-claw multi-tree scenario: allocates stats (0x3A) and all 30 Assassin skills '
            '(251..280 via 0x3B), summons Shadow Master, activates Burst of Speed/Venom/Blade Shield/Cloak of Shadows, '
            'casts Mind Blast/Fire Blast/Shock Web/Blade Sentinel, lays Wake of Fire/Lightning Sentry/Death Sentry traps, '
            'and charges Tiger Strike + Phoenix Strike into Dragon Claw finisher.'
        ),
        'seed': 12345,
        'save': 'tests/fixtures/oracle/k6/saves/k6-assassin-skills.d2s',
        'difficulty': 0,
        'frames': 390,
        'statIds': STAT_IDS,
        'oracleSetExp': [2, 350000000],
        'oracleSetGold': [2, 500000],
        'oracleEquip': [
            [2, 'ktr', 5, 6, 40],
            [2, 'rin', 6, 6, 40],
            [2, 'amu', 2, 7, 40],
        ],
        'oracleSnapshot': [2],
        'inputs': inputs,
    }
    return save_bytes, scn


def build_items_belt_combat_scenario() -> tuple[bytes, dict]:
    # Barbarian L1 leveled at F2 with equipped helm, belt, gloves, boots, secondary weapon!
    # Starting items on L1 Barbarian: id=1 Hand Axe (rarm), id=2 Buckler (larm),
    # id=3..6 hp1 in belt, id=7 tsc (inv), id=8 isc (inv).
    # F2 oracleEquip adds: id=9 cap (loc 1), id=10 lbl (loc 8), id=11 lgl (loc 10), id=12 spc (loc 11).
    save_bytes = make_new_char_d2s(4)  # Barbarian
    inputs: list[dict] = [
        {'frame': 4, 'c2s': c2s_add_stat(0, 80), 'note': '+80 Strength for melee kill'},
        {'frame': 5, 'c2s': c2s_add_stat(2, 60), 'note': '+60 Dexterity for AR'},
        {'frame': 6, 'c2s': c2s_add_stat(3, 80), 'note': '+80 Vitality'},
        # Belt & cursor/inventory manipulation
        {'frame': 8, 'c2s': c2s_belt_use(3, 0), 'note': '0x26 drink belt potion #3'},
        {'frame': 10, 'c2s': c2s_belt_remove(4), 'note': '0x24 remove belt potion #4 to cursor'},
        {'frame': 12, 'c2s': c2s_belt_put(4, 0), 'note': '0x23 put cursor potion #4 back into belt slot 0'},
        {'frame': 14, 'c2s': c2s_belt_remove(5), 'note': '0x24 remove belt potion #5 to cursor'},
        {'frame': 16, 'c2s': c2s_drop_cursor(5), 'note': '0x17 drop cursor potion #5 to ground (t4 mode 3)'},
        {'frame': 18, 'c2s': c2s_pickup(5, 0), 'note': '0x16 pick ground potion #5 into inventory'},
        {'frame': 20, 'c2s': c2s_item_to_belt(5), 'note': '0x63 shift-move inventory potion #5 back to belt'},
        # Inventory buffer & body equipment & gold pile
        {'frame': 22, 'c2s': c2s_item_to_cursor(8), 'note': '0x19 pick identify scroll #8 from inventory to cursor'},
        {'frame': 24, 'c2s': c2s_place_buf(8, 2, 2, 0), 'note': '0x18 place identify scroll #8 at inv (2,2)'},
        {'frame': 26, 'c2s': c2s_unequip(1), 'note': '0x1C unequip helm (slot 1 -> cursor #9)'},
        {'frame': 28, 'c2s': c2s_equip(9, 1), 'note': '0x1A re-equip helm #9 onto slot 1'},
        {'frame': 30, 'c2s': c2s_swap_weapons(), 'note': '0x60 swap to secondary weapon tab'},
        {'frame': 32, 'c2s': c2s_swap_weapons(), 'note': '0x60 swap back to primary weapon tab'},
        {'frame': 34, 'c2s': c2s_drop_gold(1, 500), 'note': '0x50 drop 500 gold pile onto ground'},
    ]
    inputs.extend(blood_moor_route(38))
    # In Blood Moor: open Town Portal via tsc (#7), then melee kill zombie #10 & #9!
    inputs.extend([
        {'frame': 215, 'c2s': c2s_use_item(7, 5662, 5802), 'note': '0x20 use Scroll of Town Portal (#7) in Blood Moor'},
        {'frame': 222, 'c2s': c2s_add_skill(126), 'note': '0x3B learn Bash (126)'},
        {'frame': 224, 'c2s': c2s_sel_skill(126, True), 'note': '0x3C select Bash on left hand'},
        {'frame': 226, 'c2s': c2s_l_unit(10, 1, False), 'note': '0x06 Bash zombie #10'},
        {'frame': 246, 'c2s': c2s_l_unit(10, 1, False), 'note': '0x06 Bash zombie #10'},
        {'frame': 266, 'c2s': c2s_l_unit(9, 1, False), 'note': '0x06 Bash zombie #9'},
        {'frame': 286, 'c2s': c2s_l_unit(9, 1, False), 'note': '0x06 Bash zombie #9'},
        {'frame': 306, 'c2s': c2s_l_unit(11, 1, False), 'note': '0x06 Bash zombie #11'},
    ])
    scn = {
        'name': 'k6-items-potions-belt-combat',
        'description': (
            'Item/belt/potion/scroll/gold & Blood Moor combat scenario: exercises 0x26 belt drink, 0x24/0x23/0x63 '
            'belt transfers, 0x17/0x16 ground drop & pickup, 0x19/0x18 inventory grid move, 0x1C/0x1A body unequip/equip, '
            '0x60 weapon swap, 0x50 gold pile drop, 0x20 Town Portal scroll in Blood Moor, and 0x06 Bash kills with t4 item drops.'
        ),
        'seed': 12345,
        'save': 'tests/fixtures/oracle/k6/saves/k6-items-potions-belt-combat.d2s',
        'difficulty': 0,
        'frames': 340,
        'statIds': STAT_IDS,
        'oracleSetExp': [2, 350000000],
        'oracleSetGold': [2, 250000],
        'oracleEquip': [
            [2, 'cap', 1, 4, 40],
            [2, 'lbl', 8, 4, 40],
            [2, 'lgl', 10, 4, 40],
            [2, 'spc', 11, 6, 40],
        ],
        'oracleSnapshot': [2],
        'inputs': inputs,
    }
    return save_bytes, scn


def build_town_npc_gamble_waypoint_scenario() -> tuple[bytes, dict]:
    # Paladin L40 in Rogue Encampment with Horadric Cube ('box ' #9), tsc (#10), isc (#11), rvs (#12)
    extras = [
        make_compact_jm('box ', 0, 0),
        make_compact_jm('tsc ', 2, 0),
        make_compact_jm('isc ', 3, 0),
        make_compact_jm('rvs ', 4, 0),
    ]
    save_bytes = build_paladin_save(0, {}, extras)
    inputs: list[dict] = [
        # Chat, Say emote, Quest log, Stat/Skill/WeaponSwap (note: 0x14 OverheadChat omitted because
        # D2Game 0x6FCECA30 leaves S2C 0x26 bytes 8..9 uninitialized on stack)
        {'frame': 4, 'c2s': c2s_chat('hello'), 'note': '0x15 normal chat'},
        {'frame': 6, 'c2s': c2s_say(26), 'note': '0x3F voice emote'},
        {'frame': 7, 'c2s': c2s_quest_log(), 'note': '0x40 quest log status request'},
        {'frame': 8, 'c2s': c2s_add_stat(3, 5), 'note': '0x3A +5 Vitality'},
        {'frame': 9, 'c2s': c2s_add_skill(98), 'note': '0x3B learn Might (98)'},
        {'frame': 10, 'c2s': c2s_sel_skill(98, False), 'note': '0x3C select Might'},
        {'frame': 11, 'c2s': c2s_swap_weapons(), 'note': '0x60 weapon swap'},
        {'frame': 12, 'c2s': c2s_swap_weapons(), 'note': '0x60 weapon swap restore'},
        # 1. Stash (#17 at 5646, 5919) + Horadric Cube (#9)
        {'frame': 14, 'c2s': c2s_run(5647, 5919), 'note': 'step to Stash (#17)'},
        {'frame': 24, 'c2s': c2s_interact(17, 2), 'note': '0x13 Interact Stash (#17)'},
        {'frame': 27, 'c2s': c2s_click_button(0x14, 15000), 'note': '0x4F DepositGold 15,000'},
        {'frame': 29, 'c2s': c2s_click_button(0x13, 3000), 'note': '0x4F WithdrawGold 3,000'},
        {'frame': 31, 'c2s': c2s_item_to_cursor(10), 'note': '0x19 pick tsc (#10) to cursor'},
        {'frame': 33, 'c2s': c2s_place_buf(10, 0, 0, 4), 'note': '0x18 place tsc (#10) into Stash buffer (4)'},
        {'frame': 35, 'c2s': c2s_click_button(0x12, 0), 'note': '0x4F CloseStash (0x12)'},
        # Horadric Cube (#9) open + put item + transmute + close
        {'frame': 38, 'c2s': c2s_use_item(9, 5647, 5919), 'note': '0x20 open Horadric Cube (#9)'},
        {'frame': 40, 'c2s': c2s_item_to_cursor(11), 'note': '0x19 pick isc (#11) to cursor'},
        {'frame': 42, 'c2s': c2s_item_to_cube(11, 9), 'note': '0x2A put cursor item (#11) into Cube (#9)'},
        {'frame': 44, 'c2s': c2s_click_button(0x18, 0), 'note': '0x4F Transmute Cube (0x18)'},
        {'frame': 46, 'c2s': c2s_click_button(0x17, 0), 'note': '0x4F CloseCube (0x17)'},
        {'frame': 48, 'c2s': c2s_use_item(12, 5647, 5919), 'note': '0x20 drink Rejuvenation Potion (#12)'},
        # 2. Route north around campfire to Waypoint (#15 at 5634, 5889)
        {'frame': 50, 'c2s': c2s_run(5650, 5902), 'note': 'run north around tent'},
        {'frame': 66, 'c2s': c2s_run(5636, 5891), 'note': 'approach Waypoint (#15)'},
        {'frame': 84, 'c2s': c2s_interact(15, 2), 'note': '0x13 Interact Waypoint (#15)'},
        {'frame': 88, 'c2s': c2s_waypoint(15, 0), 'note': '0x49 close Waypoint menu'},
        # 3. Charsi (#6 at 5614, 5907): Trade + Sell + RepairAll
        {'frame': 92, 'c2s': c2s_run(5618, 5907), 'note': 'run to Charsi (#6)'},
        {'frame': 114, 'c2s': c2s_interact(6, 1), 'note': '0x13 Interact Charsi (#6)'},
        {'frame': 118, 'c2s': c2s_npc_init(6, 1), 'note': '0x2F NpcInit Charsi (#6)'},
        {'frame': 121, 'c2s': c2s_npc_action(1, 6, 0), 'note': '0x38 Open Charsi Trade shop'},
        {'frame': 125, 'c2s': c2s_npc_sell(6, 6, 0, 50), 'note': '0x33 Sell isc (#6) to Charsi'},
        {'frame': 128, 'c2s': c2s_npc_repair_all(6), 'note': '0x35 RepairAll at Charsi'},
        {'frame': 131, 'c2s': c2s_npc_cancel(6, 1), 'note': '0x30 NpcCancel Charsi'},
        # 4. Gheed (spawns as #9 near 5620, 5965): Gamble shop!
        {'frame': 135, 'c2s': c2s_run(5618, 5938), 'note': 'run south toward Gheed'},
        {'frame': 158, 'c2s': c2s_run(5620, 5960), 'note': 'step next to Gheed (#9)'},
        {'frame': 184, 'c2s': c2s_interact(9, 1), 'note': '0x13 Interact Gheed (#9)'},
        {'frame': 188, 'c2s': c2s_npc_init(9, 1), 'note': '0x2F NpcInit Gheed (#9)'},
        {'frame': 192, 'c2s': c2s_npc_action(2, 9, 0), 'note': '0x38 Open Gheed Gamble window (action=2)'},
        {'frame': 198, 'c2s': c2s_npc_cancel(9, 1), 'note': '0x30 NpcCancel Gheed'},
        # 5. Kashya (#3 near 5676, 5930): Mercenary hire list!
        {'frame': 202, 'c2s': c2s_run(5648, 5940), 'note': 'run east toward Kashya'},
        {'frame': 224, 'c2s': c2s_run(5674, 5930), 'note': 'approach Kashya (#3)'},
        {'frame': 248, 'c2s': c2s_interact(3, 1), 'note': '0x13 Interact Kashya (#3)'},
        {'frame': 252, 'c2s': c2s_npc_init(3, 1), 'note': '0x2F NpcInit Kashya (#3)'},
        {'frame': 256, 'c2s': c2s_npc_action(3, 3, 0), 'note': '0x38 Open Kashya Hire list (action=3)'},
        {'frame': 262, 'c2s': c2s_npc_cancel(3, 1), 'note': '0x30 NpcCancel Kashya'},
    ]
    scn = {
        'name': 'k6-town-npc-gamble-waypoint',
        'description': (
            'Rogue Encampment town & NPC multi-subsystem scenario: exercises chat/emote/questlog '
            '(0x15, 0x3F, 0x40), stat/skill/swap (0x3A, 0x3B, 0x3C, 0x60), Stash deposit/withdraw/store '
            '(0x13, 0x4F, 0x19, 0x18), Horadric Cube open/insert/transmute (0x20, 0x2A, 0x4F), Waypoint (0x13, 0x49), '
            'Charsi Trade/Sell/RepairAll (0x2F, 0x38, 0x33, 0x35, 0x30), Gheed Gamble generation (0x38 action=2), '
            'and Kashya Mercenary Hire list (0x38 action=3).'
        ),
        'seed': 12345,
        'save': 'tests/fixtures/oracle/k6/saves/k6-town-npc-gamble-waypoint.d2s',
        'difficulty': 0,
        'frames': 275,
        'statIds': STAT_IDS,
        'oracleSetGold': [2, 250000],
        'oracleSnapshot': [2],
        'inputs': inputs,
    }
    return save_bytes, scn


def build_act3_consumables_quest_scenario() -> tuple[bytes, dict]:
    # Act 3 Kurast Docks: Jade Figurine ('j34 ' #9), Potion of Life ('xyz ' #10),
    # Book of Skill ('ass ' #11), Scroll of Resistance ('tr2 ' #12).
    extras = [
        make_compact_jm('j34 ', 0, 0),
        make_compact_jm('xyz ', 1, 0),
        make_compact_jm('ass ', 2, 0),
        make_compact_jm('tr2 ', 4, 0),
    ]
    save_bytes = build_paladin_save(2, {20: 0x0004}, extras)
    inputs: list[dict] = [
        {'frame': 10, 'c2s': c2s_run(5113, 5166), 'note': 'step to Meshif (#3) on Kurast Docks pier'},
        {'frame': 34, 'c2s': c2s_interact(3, 1), 'note': '0x13 Interact Meshif (#3)'},
        {'frame': 38, 'c2s': c2s_npc_init(3, 1), 'note': '0x2F NpcInit Meshif (#3)'},
        {'frame': 42, 'c2s': c2s_quest_msg(3, 0x0211), 'note': "0x31 A3Q1 Meshif Jade Figurine -> Golden Bird ('g34 ')"},
        {'frame': 46, 'c2s': c2s_npc_cancel(3, 1), 'note': '0x30 NpcCancel Meshif (#3)'},
        {'frame': 56, 'c2s': c2s_use_item(10, 5113, 5166), 'note': "0x20 UseItem Potion of Life ('xyz ' #10 -> +20 MaxHP)"},
        {'frame': 66, 'c2s': c2s_use_item(11, 5113, 5166), 'note': "0x20 UseItem Book of Skill ('ass ' #11 -> +1 skill)"},
        {'frame': 76, 'c2s': c2s_use_item(12, 5113, 5166), 'note': "0x20 UseItem Scroll of Resistance ('tr2 ' #12 -> +10 resists)"},
        {'frame': 90, 'c2s': c2s_run(5125, 5172), 'note': 'walk east along Kurast Docks pier'},
    ]
    scn = {
        'name': 'k6-act3-consumables-quest',
        'description': (
            'Act 3 Kurast Docks quest & permanent-stat consumables scenario: exchanges Jade Figurine for Golden Bird '
            "at Meshif (0x13/0x2F/0x31 0x0211/0x30), then consumes Potion of Life ('xyz ' +20 MaxHP), Book of Skill "
            "('ass ' +1 skill point), and Scroll of Resistance ('tr2 ' +10 all resists) via C2S 0x20."
        ),
        'seed': 12345,
        'save': 'tests/fixtures/oracle/k6/saves/k6-act3-consumables-quest.d2s',
        'difficulty': 0,
        'frames': 140,
        'statIds': STAT_IDS,
        'oracleSnapshot': [2],
        'inputs': inputs,
    }
    return save_bytes, scn


def build_nightmare_bloodmoor_combat_scenario() -> tuple[bytes, dict]:
    with open(os.path.join(LEGACY_SAVES_DIR, 'paladin-l40-auras.d2s'), 'rb') as f:
        raw = bytearray(f.read())
    # Set Progression byte (+0x25 = 15, Patriarch; checked at 0x6FD0BBF0 `(dwStatus >> 8) & 0x1F >= 5`)
    # so D2Game admits the Expansion character into Nightmare (difficulty=1).
    raw[0x25] = 15
    save_bytes = fix_d2s_checksum(raw)
    inputs: list[dict] = [
        {'frame': 4, 'c2s': c2s_add_stat(0, 60), 'note': '0x3A +60 Strength'},
        {'frame': 5, 'c2s': c2s_add_stat(2, 60), 'note': '0x3A +60 Dexterity'},
        {'frame': 6, 'c2s': c2s_add_stat(3, 80), 'note': '0x3A +80 Vitality'},
        {'frame': 8, 'c2s': c2s_add_skill(115), 'note': '0x3B learn Vigor (115)'},
        {'frame': 9, 'c2s': c2s_sel_skill(115, False), 'note': '0x3C activate Vigor aura for fast gate exit'},
    ]
    inputs.extend(blood_moor_route(12))
    inputs.extend([
        {'frame': 192, 'c2s': c2s_run(5674, 5793), 'note': '0x03 run to Nightmare Quill Rat pack (#9..#12)'},
        {'frame': 210, 'c2s': c2s_sel_skill(113, False), 'note': '0x3C switch right aura to Concentration (113)'},
        {'frame': 214, 'c2s': c2s_l_unit(12, 1, False), 'note': '0x06 melee attack Nightmare Quill Rat #12'},
        {'frame': 234, 'c2s': c2s_l_unit(12, 1, False), 'note': '0x06 melee attack Nightmare Quill Rat #12'},
        {'frame': 254, 'c2s': c2s_l_unit(11, 1, False), 'note': '0x06 melee attack Nightmare Quill Rat #11'},
        {'frame': 274, 'c2s': c2s_l_unit(11, 1, False), 'note': '0x06 melee attack Nightmare Quill Rat #11'},
        {'frame': 294, 'c2s': c2s_l_unit(10, 1, False), 'note': '0x06 melee attack Nightmare Quill Rat #10'},
        {'frame': 314, 'c2s': c2s_l_unit(10, 1, False), 'note': '0x06 melee attack Nightmare Quill Rat #10'},
        {'frame': 334, 'c2s': c2s_l_unit(9, 1, False), 'note': '0x06 melee attack Nightmare Quill Rat #9'},
    ])
    scn = {
        'name': 'k6-nightmare-bloodmoor-combat',
        'description': (
            'Nightmare difficulty (difficulty=1) Blood Moor combat & item drop scenario: Paladin L72 runs out of '
            'Rogue Encampment with Vigor (115) into Nightmare Blood Moor, switches to Concentration (113), engages '
            'and kills Nightmare Quill Rats (#9..#12, class 63) with spike missiles, Nightmare scaling, resistance '
            'penalty (-40), XP, and t4 item drops.'
        ),
        'seed': 12345,
        'save': 'tests/fixtures/oracle/k6/saves/k6-nightmare-bloodmoor-combat.d2s',
        'difficulty': 1,
        'frames': 360,
        'statIds': STAT_IDS,
        'oracleSetExp': [2, 350000000],
        'oracleSnapshot': [2],
        'inputs': inputs,
    }
    return save_bytes, scn


def build_bloodmoor_consumables_auras_combat_scenario() -> tuple[bytes, dict]:
    # Paladin L40 in Rogue Encampment with Potion of Life ('xyz ' #9), Book of Skill ('ass ' #10),
    # and Scroll of Resistance ('tr2 ' #11): Warriv greets player at spawn (S2C 0x2C), player consumes
    # all 3 permanent-stat items (0x20), runs out North Gate into Blood Moor, activates Concentration
    # (113) + Fanaticism (122) via 0x3C, and kills Blood Moor zombies (#10, #9) with t4 drops & S2C!
    extras = [
        make_compact_jm('xyz ', 0, 0),
        make_compact_jm('ass ', 1, 0),
        make_compact_jm('tr2 ', 3, 0),
    ]
    save_bytes = build_paladin_save(0, {}, extras)
    inputs: list[dict] = [
        {'frame': 6, 'c2s': c2s_use_item(9, 5653, 5918), 'note': "0x20 UseItem Potion of Life ('xyz ' #9 -> +20 MaxHP)"},
        {'frame': 10, 'c2s': c2s_use_item(10, 5653, 5918), 'note': "0x20 UseItem Book of Skill ('ass ' #10 -> +1 skill)"},
        {'frame': 14, 'c2s': c2s_use_item(11, 5653, 5918), 'note': "0x20 UseItem Scroll of Resistance ('tr2 ' #11 -> +10 resists)"},
        # Run out North Gate into Blood Moor
        {'frame': 20, 'c2s': c2s_run(5645, 5906), 'note': 'route to north gate 1'},
        {'frame': 44, 'c2s': c2s_run(5652, 5894), 'note': 'route to north gate 2'},
        {'frame': 68, 'c2s': c2s_run(5664, 5882), 'note': 'route to north gate 3'},
        {'frame': 92, 'c2s': c2s_run(5665, 5879), 'note': 'route through north gate 4'},
        {'frame': 116, 'c2s': c2s_run(5666, 5860), 'note': 'route north into Blood Moor 5'},
        {'frame': 142, 'c2s': c2s_run(5666, 5843), 'note': 'route north into Blood Moor 6'},
        {'frame': 168, 'c2s': c2s_run(5665, 5827), 'note': 'route north into Blood Moor 7'},
        {'frame': 194, 'c2s': c2s_run(5664, 5817), 'note': 'route north into Blood Moor 8'},
        {'frame': 220, 'c2s': c2s_run(5662, 5802), 'note': 'arrive at Blood Moor zombie pack'},
        {'frame': 244, 'c2s': c2s_sel_skill(113, False), 'note': '0x3C activate Concentration aura (113)'},
        {'frame': 252, 'c2s': c2s_l_unit(10, 1, False), 'note': '0x06 melee attack zombie #10'},
        {'frame': 272, 'c2s': c2s_l_unit(10, 1, False), 'note': '0x06 melee attack zombie #10'},
        {'frame': 292, 'c2s': c2s_l_unit(10, 1, False), 'note': '0x06 melee attack zombie #10'},
        {'frame': 312, 'c2s': c2s_sel_skill(122, False), 'note': '0x3C switch to Fanaticism aura (122)'},
        {'frame': 318, 'c2s': c2s_l_unit(9, 1, False), 'note': '0x06 melee attack zombie #9'},
        {'frame': 338, 'c2s': c2s_l_unit(9, 1, False), 'note': '0x06 melee attack zombie #9'},
        {'frame': 358, 'c2s': c2s_l_unit(9, 1, False), 'note': '0x06 melee attack zombie #9'},
    ]
    scn = {
        'name': 'k6-bloodmoor-consumables-auras-combat',
        'description': (
            'Full-horizon multi-subsystem Act 1 consumables + Warriv town AI + Paladin aura Blood Moor combat & '
            "item-drop scenario: consumes Potion of Life ('xyz '), Book of Skill ('ass '), and Scroll of Resistance "
            "('tr2 ') via 0x20, runs out North Gate into Blood Moor, activates Concentration (113) and Fanaticism "
            '(122) via 0x3C, and kills zombies (#10, #9) via 0x06 with t4 ground drops and S2C packets.'
        ),
        'seed': 12345,
        'save': 'tests/fixtures/oracle/k6/saves/k6-bloodmoor-consumables-auras-combat.d2s',
        'difficulty': 0,
        'frames': 380,
        'statIds': STAT_IDS,
        'oracleSnapshot': [2],
        'inputs': inputs,
    }
    return save_bytes, scn


BUILDERS = [
    build_bloodmoor_consumables_auras_combat_scenario,
    build_druid_scenario,
    build_assassin_scenario,
    build_items_belt_combat_scenario,
    build_town_npc_gamble_waypoint_scenario,
    build_act3_consumables_quest_scenario,
    build_nightmare_bloodmoor_combat_scenario,
]


def run_headless_capture(oracle_root: str, save_path: str, scenario_obj: dict, with_cover: bool) -> tuple[bytes, bytes, bytes]:
    wine_bin_dir = os.path.join(oracle_root, 'wine', 'root', 'usr', 'lib', 'x86_64-linux-gnu', 'wine')
    build_dir = os.path.join(oracle_root, 'build')
    manifest_path = os.path.join(REPO, 'tools', 'oracle', 'callgraph', 'manifest-113c.json')
    manifest_fns = json.load(open(manifest_path, encoding='utf-8'))['functions']

    tmp_base = os.environ.get('TMPDIR', os.path.join(os.path.expanduser('~'), '.cache', 'd2oracle-runs'))
    os.makedirs(tmp_base, exist_ok=True)
    pfx = tempfile.mkdtemp(prefix='d2host-k6-', dir=tmp_base)
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

        frames = int(scenario_obj['frames'])
        with open(os.path.join(c_ora, 'scenario.txt'), 'w', encoding='utf-8') as f:
            f.write(f'frames {frames}\n')
            f.write(f"states {int(scenario_obj.get('stateCount', 183))}\n")
            if scenario_obj.get('statIds'):
                f.write('stats ' + ','.join(str(int(x)) for x in scenario_obj['statIds']) + '\n')
            if scenario_obj.get('oracleSetExp'):
                f.write('setexp ' + ' '.join(str(int(v)) for v in scenario_obj['oracleSetExp']) + '\n')
            if scenario_obj.get('oracleSetGold'):
                f.write('setgold ' + ' '.join(str(int(v)) for v in scenario_obj['oracleSetGold']) + '\n')
            for eq in scenario_obj.get('oracleEquip', []):
                f.write(f'equip {int(eq[0])} {str(eq[1])} {int(eq[2])} {int(eq[3])} {int(eq[4])}\n')
            for sf in scenario_obj.get('oracleSnapshot', []):
                f.write(f'snapshot {int(sf)}\n')
            if with_cover:
                f.write(f'cover 1 {frames}\n')
                for fn in manifest_fns:
                    mod = {'D2Game': 'g', 'D2Common': 'c'}[fn['module']]
                    f.write(f"cva {mod} {fn['va'][2:].lower()}\n")
            for inp in scenario_obj['inputs']:
                f.write(f"in {int(inp['frame'])} {inp['c2s'].replace(' ', '').lower()}\n")

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
                str(frames),
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
        cov_bytes = b''
        if with_cover:
            with open(os.path.join(c_ora, 'out', 'cover.ndjson'), 'rb') as fc:
                cov_bytes = fc.read()
        return trace_bytes, snap_bytes, cov_bytes
    finally:
        shutil.rmtree(pfx, ignore_errors=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--record', action='store_true', help='Record .oracle.ndjson.gz + .snap-f002.ndjson.gz + .coverage.ndjson.gz')
    ap.add_argument('--only', default='', help='Optional scenario name filter')
    args = ap.parse_args()

    os.makedirs(SCN_OUT_DIR, exist_ok=True)
    os.makedirs(K6_FIX_DIR, exist_ok=True)
    os.makedirs(K6_SAVES_DIR, exist_ok=True)

    oracle_root = os.environ.get(
        'D2_ORACLE_ROOT',
        os.path.join(os.path.expanduser('~'), '.local', 'opt', 'd2oracle'),
    )
    if args.record:
        build_dir = os.path.join(oracle_root, 'build')
        subprocess.run([os.path.join(REPO, 'tools', 'oracle', 'hook', 'build.sh'), build_dir], check=True, stdout=subprocess.DEVNULL)
        subprocess.run([os.path.join(REPO, 'tools', 'oracle', 'headless', 'build.sh'), build_dir], check=True, stdout=subprocess.DEVNULL)

    for builder in BUILDERS:
        save_bytes, scn = builder()
        name = scn['name']
        if args.only and name != args.only:
            continue
        save_abs = os.path.join(REPO, scn['save'])
        with open(save_abs, 'wb') as fs:
            fs.write(save_bytes)
        scn_abs = os.path.join(SCN_OUT_DIR, f'{name}.json')
        with open(scn_abs, 'w', encoding='utf-8') as fj:
            json.dump(scn, fj, indent=2)
            fj.write('\n')

        if args.record:
            # Record golden + F2 snapshot without VEH INT3 stack perturbation (asserting 2-run SHA-256 identity),
            # then record INT3 coverage and assert 100% frame-by-frame game-state identity (t0, t1, t3, t4, gs, in).
            trace1, snap1, _ = run_headless_capture(oracle_root, save_abs, scn, with_cover=False)
            trace2, _, _ = run_headless_capture(oracle_root, save_abs, scn, with_cover=False)
            if hashlib.sha256(trace1).digest() != hashlib.sha256(trace2).digest():
                raise RuntimeError(f'non-deterministic golden trace for {name}')
            trace_cov, _, cov1 = run_headless_capture(oracle_root, save_abs, scn, with_cover=True)
            rows_gold = [json.loads(l) for l in trace1.decode('utf-8').splitlines() if l.strip()][1:]
            rows_cov = [json.loads(l) for l in trace_cov.decode('utf-8').splitlines() if l.strip()][1:]
            if len(rows_gold) != len(rows_cov):
                raise RuntimeError(f'{name}: frame count mismatch ({len(rows_gold)} vs {len(rows_cov)})')
            for rg, rc_row in zip(rows_gold, rows_cov):
                for key in ('frame', 't0', 't1', 't3', 't4', 'gs', 'in'):
                    if rg.get(key) != rc_row.get(key):
                        raise RuntimeError(f"{name}: frame {rg.get('frame')} {key} differs under INT3 cover")

            rc_counts: dict[int, int] = {}
            for line in trace1.decode('utf-8').splitlines():
                if not line.strip():
                    continue
                row = json.loads(line)
                for entry in row.get('in', []):
                    rc = int(entry[0])
                    rc_counts[rc] = rc_counts.get(rc, 0) + 1

            cov_hdr = json.loads(cov1.decode('utf-8').splitlines()[0])
            golden_gz = gzip_deterministic(trace1)
            snap_gz = gzip_deterministic(snap1)
            cov_gz = gzip_deterministic(cov1)

            with open(os.path.join(K6_FIX_DIR, f'{name}.oracle.ndjson.gz'), 'wb') as fg:
                fg.write(golden_gz)
            with open(os.path.join(K6_FIX_DIR, f'{name}.snap-f002.ndjson.gz'), 'wb') as fsn:
                fsn.write(snap_gz)
            with open(os.path.join(K6_FIX_DIR, f'{name}.coverage.ndjson.gz'), 'wb') as fc:
                fc.write(cov_gz)

            print(
                f'recorded {name:30s} frames={scn["frames"]:3d} rc={rc_counts} '
                f'hits={cov_hdr["hit"]:4d} golden={len(golden_gz):6d}B snap={len(snap_gz):6d}B cov={len(cov_gz):5d}B'
            )
        else:
            print(f'wrote {name}.json and {name}.d2s ({len(save_bytes)}B)')


if __name__ == '__main__':
    main()

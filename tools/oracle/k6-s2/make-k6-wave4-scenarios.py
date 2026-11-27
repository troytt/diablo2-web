#!/usr/bin/env python3
"""Generate and record the [K6] Wave 4 multi-class & Act 2-5 headless 1.13c DLL scenarios.

Outputs:
  - tools/oracle/k6-s2/scenarios/<name>.json
  - tests/fixtures/oracle/k6-s2/saves/<name>.d2s
  - tests/fixtures/oracle/k6-s2/<name>.oracle.ndjson.gz
  - tests/fixtures/oracle/k6-s2/<name>.snap-f002.ndjson.gz
  - tests/fixtures/oracle/k6-s2/<name>.coverage.ndjson.gz

Environment overrides (portable, zero hardcoded machine paths):
  D2_ORACLE_ROOT   Path to headless 1.13c Wine/DLL bundle (default: ~/.local/opt/d2oracle)

Usage:
  python3 tools/oracle/k6-s2/make-k6-wave4-scenarios.py [--record] [--only <name>]
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
FIX_DIR = os.path.join(REPO, 'tests', 'fixtures', 'oracle', 'k6-s2')
SAVES_DIR = os.path.join(FIX_DIR, 'saves')
LEGACY_SAVES_DIR = os.path.join(REPO, 'tests', 'fixtures', 'oracle', 'saves')

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


def build_act_paladin_save(
    act: int,
    difficulty: int = 0,
    quest_words: dict | None = None,
    extra_compact_items=(),
    unlock_all_waypoints: bool = True,
) -> bytes:
    with open(os.path.join(LEGACY_SAVES_DIR, 'paladin-l40-auras.d2s'), 'rb') as f:
        raw = bytearray(f.read())
    raw[0x25] = 15  # Patriarch progression: permits Normal, Nightmare, and Hell entry
    raw[0xA8] = 0
    raw[0xA9] = 0
    raw[0xAA] = 0
    raw[0xA8 + difficulty] = 0x80 | act
    merged = {**ACT_UNLOCK_WORDS[act], **(quest_words or {})}
    for d in range(3):
        base_q = 0x159 + d * 0x60
        for widx, wval in merged.items():
            struct.pack_into('<H', raw, base_q + widx * 2, wval)
    if unlock_all_waypoints:
        ws = raw.find(b'WS')
        if ws >= 0:
            for d in range(3):
                wp_off = ws + 8 + d * 24 + 2
                raw[wp_off : wp_off + 5] = bytes([0xFF, 0xFF, 0xFF, 0xFF, 0x7F])
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


def c2s_walk_unit(uid: int, utype: int = 1) -> str:
    return '02' + struct.pack('<II', utype, uid).hex()


def c2s_run(x: int, y: int) -> str:
    return '03' + struct.pack('<HH', x, y).hex()


def c2s_run_unit(uid: int, utype: int = 1) -> str:
    return '04' + struct.pack('<II', utype, uid).hex()


def c2s_l_loc(x: int, y: int, hold: bool = False) -> str:
    op = '08' if hold else '05'
    return op + struct.pack('<HH', x, y).hex()


def c2s_l_unit(uid: int, utype: int = 1, shift: bool = False, hold: bool = False) -> str:
    if shift:
        op = '0a' if hold else '07'
    else:
        op = '09' if hold else '06'
    return op + struct.pack('<II', utype, uid).hex()


def c2s_noop_0b() -> str:
    return '0b'


def c2s_r_loc(x: int, y: int, hold: bool = False) -> str:
    op = '0f' if hold else '0c'
    return op + struct.pack('<HH', x, y).hex()


def c2s_r_unit(uid: int, utype: int = 1, shift: bool = False, hold: bool = False) -> str:
    if shift:
        op = '11' if hold else '0e'
    else:
        op = '10' if hold else '0d'
    return op + struct.pack('<II', utype, uid).hex()


def c2s_interact(uid: int, utype: int = 1) -> str:
    return '13' + struct.pack('<II', utype, uid).hex()


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


def c2s_swap_2h(item_id: int, slot: int) -> str:
    return '1b' + struct.pack('<IHH', item_id, slot, 0).hex()


def c2s_unequip(slot: int) -> str:
    return '1c' + struct.pack('<H', slot).hex()


def c2s_swap_body(item_id: int, slot: int) -> str:
    return '1d' + struct.pack('<IHH', item_id, slot, 0).hex()


def c2s_swap_container(cursor_id: int, target_id: int, x: int, y: int) -> str:
    return '1f' + struct.pack('<IIII', cursor_id, target_id, x, y).hex()


def c2s_use_item(item_id: int, x: int, y: int) -> str:
    return '20' + struct.pack('<III', item_id, x, y).hex()


def c2s_stack_items(cursor_id: int, target_id: int) -> str:
    return '21' + struct.pack('<II', cursor_id, target_id).hex()


def c2s_belt_put(item_id: int, slot: int) -> str:
    return '23' + struct.pack('<II', item_id, slot).hex()


def c2s_belt_remove(item_id: int) -> str:
    return '24' + struct.pack('<I', item_id).hex()


def c2s_belt_swap(cursor_id: int, belt_id: int) -> str:
    return '25' + struct.pack('<II', cursor_id, belt_id).hex()


def c2s_belt_use(item_id: int, shift: int = 0) -> str:
    return '26' + struct.pack('<III', item_id, shift, 0).hex()


def c2s_identify_item(item_id: int, scroll_id: int) -> str:
    return '27' + struct.pack('<II', item_id, scroll_id).hex()


def c2s_socket_item(item_id: int, target_id: int) -> str:
    return '28' + struct.pack('<II', item_id, target_id).hex()


def c2s_scroll_to_book(scroll_id: int, book_id: int) -> str:
    return '29' + struct.pack('<II', scroll_id, book_id).hex()


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


def c2s_cain_identify(npc_id: int) -> str:
    return '34' + struct.pack('<I', npc_id).hex()


def c2s_npc_repair_all(npc_id: int) -> str:
    return '35' + struct.pack('<IIII', npc_id, 0, 0, 0x80000000).hex()


def c2s_hire_merc(npc_id: int, merc_id: int) -> str:
    return '36' + struct.pack('<II', npc_id, merc_id).hex()


def c2s_npc_action(action: int, npc_id: int, complement: int = 0) -> str:
    return '38' + struct.pack('<III', action, npc_id, complement).hex()


def c2s_add_stat(stat_id: int, count: int = 1) -> str:
    return '3a' + struct.pack('<BB', stat_id & 0x0F, max(0, min(99, count - 1))).hex()


def c2s_add_skill(skill_id: int) -> str:
    return '3b' + struct.pack('<H', skill_id & 0xFFFF).hex()


def c2s_sel_skill(skill_id: int, left: bool = False, item_id: int = 0xFFFFFFFF) -> str:
    return '3c' + struct.pack('<HBBI', skill_id & 0xFFFF, 0, 0x80 if left else 0x00, item_id & 0xFFFFFFFF).hex()


def c2s_quest_log() -> str:
    return '40'


def c2s_resurrect() -> str:
    return '41'


def c2s_waypoint(wp_uid: int, dest_area: int) -> str:
    return '49' + struct.pack('<II', wp_uid, dest_area).hex()


def c2s_click_button(button_id: int, amount: int = 0) -> str:
    return '4f' + struct.pack('<HHH', button_id & 0xFFFF, (amount >> 16) & 0xFFFF, amount & 0xFFFF).hex()


def c2s_update_pos(x: int, y: int) -> str:
    return '5f' + struct.pack('<HH', x, y).hex()


def c2s_swap_weapons() -> str:
    return '60'


def c2s_merc_item(slot: int) -> str:
    return '61' + struct.pack('<H', slot & 0xFFFF).hex()


def c2s_item_to_belt(item_id: int) -> str:
    return '63' + struct.pack('<I', item_id).hex()


def c2s_resurrect_merc(npc_id: int) -> str:
    return '62' + struct.pack('<I', npc_id).hex()


# Proven 24-26f spaced route out Rogue Encampment North Gate straight to Blood Moor zombies (5662, 5802).
# Arrives cleanly at (5662, 5802) by start_frame + 224.
def blood_moor_route(start_frame: int = 44) -> list[dict]:
    pts = [
        (0, 5645, 5906),
        (24, 5652, 5894),
        (48, 5664, 5882),
        (72, 5665, 5879),
        (96, 5666, 5860),
        (122, 5666, 5843),
        (148, 5665, 5827),
        (174, 5664, 5817),
        (200, 5662, 5802),
    ]
    return [{'frame': start_frame + df, 'c2s': c2s_run(x, y), 'note': f'run to ({x},{y})'} for df, x, y in pts]


def build_amazon_skills_scenario() -> tuple[bytes, dict]:
    save_bytes = make_new_char_d2s(0)  # Amazon
    inputs: list[dict] = [
        {'frame': 4, 'c2s': c2s_add_stat(0, 50), 'note': '+50 Strength'},
        {'frame': 5, 'c2s': c2s_add_stat(1, 90), 'note': '+90 Energy'},
        {'frame': 6, 'c2s': c2s_add_stat(2, 40), 'note': '+40 Dexterity'},
        {'frame': 7, 'c2s': c2s_add_stat(3, 40), 'note': '+40 Vitality'},
    ]
    fr = 8
    for sid in range(6, 36):
        inputs.append({'frame': fr, 'c2s': c2s_add_skill(sid), 'note': f'learn Amazon skill {sid}'})
        fr += 1
    # Pump Pierce (33) + Guided Arrow (22) + Strafe (26) for guaranteed pierce & multi-arrow volley!
    for sid in (33, 33, 33, 33, 26, 26, 12, 12):
        inputs.append({'frame': fr, 'c2s': c2s_add_skill(sid), 'note': f'boost skill {sid}'})
        fr += 1
    # fr=46: Swap to Bow+Arrows first (so Bow skills hit LIVE zombies #9/#10/#11!) + cast Valkyrie in town
    inputs.extend([
        {'frame': 46, 'c2s': c2s_noop_0b(), 'note': '0x0B noop'},
        {'frame': 47, 'c2s': c2s_update_pos(5653, 5918), 'note': '0x5F position sync'},
        {'frame': 48, 'c2s': c2s_swap_weapons(), 'note': '0x60 swap to Rare Short Bow + Arrows'},
    ])
    inputs.extend(blood_moor_route(50))  # arrives (5662, 5802) at F274 (zombies #9, #10, #11 right ahead!)
    casts = [
        # Passive & Magic tree on live zombies #9, #10, #11
        (276, c2s_sel_skill(8, False), 'select Inner Sight (8)'),
        (277, c2s_r_loc(5661, 5795), 'cast Inner Sight'),
        (289, c2s_sel_skill(17, False), 'select Slow Missiles (17)'),
        (290, c2s_r_loc(5661, 5795), 'cast Slow Missiles'),
        (302, c2s_sel_skill(28, False), 'select Decoy (28)'),
        (303, c2s_r_loc(5662, 5798), 'cast Decoy'),
        # Bow tree on live zombies #9/#10/#11 (exercising 0x05/0x08/0x0C/0x0F + Pierce/Guided/Strafe!)
        (315, c2s_sel_skill(6, True), 'select Magic Arrow (6)'),
        (316, c2s_l_loc(5661, 5795), '0x05 LeftLoc Magic Arrow'),
        (328, c2s_sel_skill(7, True), 'select Fire Arrow (7)'),
        (329, c2s_l_loc(5661, 5795, hold=True), '0x08 RepeatLeftLoc Fire Arrow'),
        (341, c2s_sel_skill(11, False), 'select Cold Arrow (11)'),
        (342, c2s_r_loc(5661, 5795), '0x0C Cold Arrow'),
        (354, c2s_sel_skill(12, False), 'select Multiple Shot (12)'),
        (355, c2s_r_loc(5661, 5795, hold=True), '0x0F RepeatRightLoc Multiple Shot'),
        (367, c2s_sel_skill(16, False), 'select Exploding Arrow (16)'),
        (368, c2s_r_unit(10, 1, shift=True), '0x0E ShiftRight Exploding Arrow'),
        (380, c2s_sel_skill(21, False), 'select Ice Arrow (21)'),
        (381, c2s_r_unit(9, 1, hold=True), '0x10 RepeatRight Ice Arrow'),
        (393, c2s_sel_skill(22, False), 'select Guided Arrow (22)'),
        (394, c2s_r_unit(11, 1, shift=True, hold=True), '0x11 RepeatShiftRight Guided Arrow at #11'),
        (408, c2s_sel_skill(26, False), 'select Strafe (26)'),
        (409, c2s_r_loc(5645, 5786), 'Strafe volley toward zombie #11'),
        (430, c2s_sel_skill(27, False), 'select Immolation Arrow (27, delay 25f)'),
        (431, c2s_r_loc(5645, 5786), 'Immolation Arrow'),
        (459, c2s_sel_skill(31, False), 'select Freezing Arrow (31)'),
        (460, c2s_r_loc(5645, 5786), 'Freezing Arrow'),
        # Swap back to Javelin + Buckler (Tab 1) and advance north to Fallen camp (5705, 5759) & zombies!
        (472, c2s_swap_weapons(), '0x60 swap back to Javelin + Buckler'),
        (476, c2s_run(5668, 5780), 'run north-east toward Fallen camp'),
        (498, c2s_run(5685, 5768), 'approach Fallen camp'),
        (520, c2s_run(5702, 5760), 'enter Fallen camp'),
        (542, c2s_sel_skill(15, False), 'select Poison Javelin (15, delay 15f)'),
        (543, c2s_r_loc(5710, 5759), 'throw Poison Javelin'),
        (560, c2s_sel_skill(20, False), 'select Lightning Bolt (20)'),
        (561, c2s_r_loc(5710, 5759), 'throw Lightning Bolt'),
        (573, c2s_sel_skill(35, False), 'select Lightning Fury (35)'),
        (574, c2s_r_loc(5710, 5759), 'throw Lightning Fury'),
        (586, c2s_sel_skill(25, False), 'select Plague Javelin (25, delay 100f)'),
        (587, c2s_r_loc(5710, 5759), 'throw Plague Javelin (8-way cloud)'),
        # Javelin/Spear melee skills on Fallen/zombies (0x04/0x06/0x07/0x09/0x0A)
        (600, c2s_sel_skill(10, True), 'select Jab (10)'),
        (601, c2s_l_loc(5707, 5759), 'Jab'),
        (615, c2s_sel_skill(14, True), 'select Power Strike (14)'),
        (616, c2s_l_loc(5707, 5759), 'Power Strike'),
        (630, c2s_sel_skill(19, True), 'select Impale (19)'),
        (631, c2s_l_loc(5707, 5759), 'Impale'),
        (648, c2s_sel_skill(24, True), 'select Charged Strike (24)'),
        (649, c2s_l_loc(5707, 5759), 'Charged Strike'),
        (664, c2s_sel_skill(30, True), 'select Fend (30)'),
        (665, c2s_l_loc(5707, 5759), 'Fend'),
        (680, c2s_sel_skill(34, True), 'select Lightning Strike (34)'),
        (681, c2s_l_loc(5707, 5759), 'Lightning Strike'),
        # Summon Valkyrie once Plague Javelin 100f cooldown clears (F587+100 = F687)!
        (694, c2s_sel_skill(32, False), 'select Valkyrie (32)'),
        (695, c2s_r_loc(5702, 5760), 'summon Valkyrie in Blood Moor'),
    ]
    for f, pkt, note in casts:
        inputs.append({'frame': f, 'c2s': pkt, 'note': note})

    scn = {
        'name': 'k6s2-amazon-skills',
        'description': (
            'Level 45 Amazon multi-tree scenario (Rare Short Bow+Arrows + Javelin+Buckler on swap): '
            'learns all 30 Amazon skills (6..35), casts Inner Sight/Slow Missiles/Decoy/Valkyrie, '
            'all 10 Bow skills (Magic/Fire/Cold/Multiple/Exploding/Ice/Guided/Strafe/Immolation/Freezing Arrow), '
            'and all 10 Javelin/Spear skills (Poison/Plague/Lightning Bolt/Fury/Jab/Power/Impale/Charged/Fend/Lightning Strike) '
            'across Blood Moor zombies and Fallen camp.'
        ),
        'seed': 12345,
        'save': 'tests/fixtures/oracle/k6-s2/saves/k6s2-amazon-skills.d2s',
        'difficulty': 0,
        'frames': 715,
        'statIds': STAT_IDS,
        'oracleSetExp': [2, 31000000],
        'oracleSetGold': [2, 250000],
        'oracleEquip': [
            [2, 'sbw', 11, 6, 40],
            [2, 'aqv', 12, 2, 40],
            [2, 'cap', 1, 6, 40],
            [2, 'lbl', 8, 6, 40],
        ],
        'oracleSnapshot': [2],
        'inputs': inputs,
    }
    return save_bytes, scn


def build_sorceress_skills_scenario() -> tuple[bytes, dict]:
    save_bytes = make_new_char_d2s(1)  # Sorceress
    inputs: list[dict] = [
        {'frame': 4, 'c2s': c2s_add_stat(0, 30), 'note': '+30 Strength'},
        {'frame': 5, 'c2s': c2s_add_stat(1, 120), 'note': '+120 Energy'},
        {'frame': 6, 'c2s': c2s_add_stat(2, 20), 'note': '+20 Dexterity'},
        {'frame': 7, 'c2s': c2s_add_stat(3, 50), 'note': '+50 Vitality'},
    ]
    fr = 8
    for sid in range(36, 66):
        inputs.append({'frame': fr, 'c2s': c2s_add_skill(sid), 'note': f'learn Sorceress skill {sid}'})
        fr += 1
    for k in range(5):
        inputs.append({'frame': fr + k, 'c2s': c2s_add_skill(37), 'note': 'pump Warmth'})
    inputs.extend([
        {'frame': 43, 'c2s': c2s_sel_skill(40, False), 'note': 'select Frozen Armor (40)'},
        {'frame': 44, 'c2s': c2s_r_loc(5653, 5918), 'note': 'cast Frozen Armor in town'},
        {'frame': 55, 'c2s': c2s_sel_skill(58, False), 'note': 'select Energy Shield (58)'},
        {'frame': 56, 'c2s': c2s_r_loc(5653, 5918), 'note': 'cast Energy Shield in town'},
        {'frame': 67, 'c2s': c2s_sel_skill(52, False), 'note': 'select Enchant (52)'},
        {'frame': 68, 'c2s': c2s_r_loc(5653, 5918), 'note': 'cast Enchant on self in town'},
    ])
    inputs.extend(blood_moor_route(76))  # arrives (5662, 5802) cleanly at F300!
    casts = [
        # Blaze + uninterrupted run across zombies to leave fire trail + let zombies hit Energy Shield & Shiver Armor!
        (304, c2s_sel_skill(57, False), 'select Thunder Storm (57)'),
        (305, c2s_r_loc(5662, 5802), 'cast Thunder Storm'),
        (317, c2s_sel_skill(50, False), 'select Shiver Armor (50)'),
        (318, c2s_r_loc(5662, 5802), 'cast Shiver Armor'),
        (330, c2s_sel_skill(46, False), 'select Blaze (46)'),
        (331, c2s_r_loc(5662, 5802), 'cast Blaze'),
        (340, c2s_run(5656, 5794), 'run with Blaze active to spawn fire trail near zombies'),
        (362, c2s_walk_unit(10, 1), '0x02 WalkToUnit zombie #10 (triggers Energy Shield + Shiver Armor)'),
        # Delayed & non-delayed Fire/Cold/Lightning skills right in zombie range!
        (380, c2s_sel_skill(56, False), 'select Meteor (56, delay 30f)'),
        (381, c2s_r_loc(5661, 5795), 'cast Meteor'),
        (393, c2s_sel_skill(38, False), 'select Charged Bolt (38)'),
        (394, c2s_r_loc(5661, 5795), 'cast Charged Bolt'),
        (406, c2s_sel_skill(42, False), 'select Static Field (42)'),
        (407, c2s_r_loc(5661, 5795), 'cast Static Field'),
        (418, c2s_sel_skill(59, False), 'select Blizzard (59, delay 45f)'),
        (419, c2s_r_loc(5661, 5795), 'cast Blizzard'),
        (431, c2s_sel_skill(43, False), 'select Telekinesis (43)'),
        (432, c2s_r_unit(10, 1), 'cast Telekinesis on zombie #10'),
        (444, c2s_sel_skill(48, False), 'select Nova (48)'),
        (445, c2s_r_loc(5662, 5798), 'cast Nova'),
        (457, c2s_sel_skill(44, False), 'select Frost Nova (44)'),
        (458, c2s_r_loc(5662, 5798), 'cast Frost Nova'),
        (470, c2s_sel_skill(62, False), 'select Hydra (62, delay 40f)'),
        (471, c2s_r_loc(5658, 5796), 'summon Hydra'),
        (483, c2s_sel_skill(49, False), 'select Lightning (49)'),
        (484, c2s_r_loc(5642, 5785), 'cast Lightning'),
        (496, c2s_sel_skill(53, False), 'select Chain Lightning (53)'),
        (497, c2s_r_loc(5642, 5785), 'cast Chain Lightning'),
        (509, c2s_sel_skill(36, True), 'select Fire Bolt (36)'),
        (510, c2s_l_loc(5642, 5785), 'cast Fire Bolt'),
        (520, c2s_sel_skill(64, False), 'select Frozen Orb (64, delay 25f)'),
        (521, c2s_r_loc(5642, 5785), 'cast Frozen Orb'),
        (533, c2s_sel_skill(47, False), 'select Fire Ball (47)'),
        (534, c2s_r_loc(5642, 5785), 'cast Fire Ball'),
        (546, c2s_sel_skill(39, True), 'select Ice Bolt (39)'),
        (547, c2s_l_loc(5642, 5785), 'cast Ice Bolt'),
        (556, c2s_sel_skill(51, False), 'select Fire Wall (51, delay 35f)'),
        (557, c2s_r_loc(5642, 5785), 'cast Fire Wall'),
        (569, c2s_sel_skill(45, False), 'select Ice Blast (45)'),
        (570, c2s_r_loc(5642, 5785), 'cast Ice Blast'),
        (582, c2s_sel_skill(55, False), 'select Glacial Spike (55)'),
        (583, c2s_r_loc(5642, 5785), 'cast Glacial Spike'),
        (595, c2s_sel_skill(41, False), 'select Inferno (41)'),
        (596, c2s_r_loc(5642, 5785), 'cast Inferno'),
        (610, c2s_sel_skill(60, False), 'select Chilling Armor (60)'),
        (611, c2s_r_loc(5656, 5794), 'cast Chilling Armor'),
        # Teleport straight into Fallen camp (5704, 5762) so Thunder Storm, Energy Shield, Chilling Armor, Hydra fire!
        (623, c2s_sel_skill(54, False), 'select Teleport (54)'),
        (624, c2s_r_loc(5704, 5762), 'Teleport to Fallen camp'),
        (640, c2s_sel_skill(62, False), 'select Hydra at Fallen camp'),
        (641, c2s_r_loc(5706, 5760), 'summon Hydra at Fallen camp'),
    ]
    for f, pkt, note in casts:
        inputs.append({'frame': f, 'c2s': pkt, 'note': note})

    scn = {
        'name': 'k6s2-sorceress-skills',
        'description': (
            'Level 45 Sorceress all-3-tree scenario: learns all 30 Sorceress skills (36..65), casts '
            'Frozen/Shiver/Chilling Armor, Energy Shield, Enchant, Thunder Storm, Blaze (with active running trail), '
            'Fire Bolt/Ball, Inferno, Fire Wall, Meteor, Hydra, Ice Bolt/Blast, Frost Nova, Glacial Spike, '
            'Blizzard, Frozen Orb, Charged Bolt, Static Field, Telekinesis, Nova, Lightning, Chain Lightning, and Teleport.'
        ),
        'seed': 12345,
        'save': 'tests/fixtures/oracle/k6-s2/saves/k6s2-sorceress-skills.d2s',
        'difficulty': 0,
        'frames': 680,
        'statIds': STAT_IDS,
        'oracleSetExp': [2, 31000000],
        'oracleSetGold': [2, 250000],
        'oracleEquip': [
            [2, 'cap', 1, 6, 40],
            [2, 'lbl', 8, 6, 40],
            [2, 'rin', 6, 6, 40],
            [2, 'amu', 2, 7, 40],
        ],
        'oracleSnapshot': [2],
        'inputs': inputs,
    }
    return save_bytes, scn


def build_necromancer_skills_scenario() -> tuple[bytes, dict]:
    save_bytes = make_new_char_d2s(2)  # Necromancer
    inputs: list[dict] = [
        {'frame': 4, 'c2s': c2s_add_stat(0, 40), 'note': '+40 Strength'},
        {'frame': 5, 'c2s': c2s_add_stat(1, 100), 'note': '+100 Energy'},
        {'frame': 6, 'c2s': c2s_add_stat(2, 30), 'note': '+30 Dexterity'},
        {'frame': 7, 'c2s': c2s_add_stat(3, 50), 'note': '+50 Vitality'},
    ]
    necro_order = [66, 67, 68] + list(range(70, 96)) + [69]
    fr = 8
    for sid in necro_order:
        inputs.append({'frame': fr, 'c2s': c2s_add_skill(sid), 'note': f'learn Necromancer skill {sid}'})
        fr += 1
    inputs.extend([
        {'frame': 38, 'c2s': c2s_sel_skill(68, False), 'note': 'select Bone Armor (68)'},
        {'frame': 39, 'c2s': c2s_r_loc(5653, 5918), 'note': 'cast Bone Armor in town'},
    ])
    # Do NOT summon Clay Golem before Blood Moor so zombies keep clean IDs #9, #10, #11!
    inputs.extend(blood_moor_route(48))  # arrives (5662, 5802) at F272!
    casts = [
        # All 10 Curses on zombies #9, #10, #11 right ahead!
        (276, c2s_sel_skill(66, False), 'select Amplify Damage (66)'),
        (277, c2s_r_loc(5661, 5795), 'cast Amplify Damage'),
        (289, c2s_sel_skill(71, False), 'select Dim Vision (71)'),
        (290, c2s_r_loc(5661, 5795), 'cast Dim Vision'),
        (302, c2s_sel_skill(72, False), 'select Weaken (72)'),
        (303, c2s_r_loc(5661, 5795), 'cast Weaken'),
        (315, c2s_sel_skill(76, False), 'select Iron Maiden (76)'),
        (316, c2s_r_loc(5661, 5795), 'cast Iron Maiden'),
        (328, c2s_sel_skill(77, False), 'select Terror (77)'),
        (329, c2s_r_loc(5661, 5795), 'cast Terror'),
        (341, c2s_sel_skill(81, False), 'select Confuse (81)'),
        (342, c2s_r_loc(5664, 5792), 'cast Confuse'),
        (354, c2s_sel_skill(82, False), 'select Life Tap (82)'),
        (355, c2s_r_loc(5664, 5792), 'cast Life Tap'),
        (367, c2s_sel_skill(86, False), 'select Attract (86)'),
        (368, c2s_r_unit(10, 1), 'cast Attract on zombie #10'),
        (380, c2s_sel_skill(87, False), 'select Decrepify (87)'),
        (381, c2s_r_loc(5661, 5795), 'cast Decrepify'),
        (393, c2s_sel_skill(91, False), 'select Lower Resist (91)'),
        (394, c2s_r_loc(5661, 5795), 'cast Lower Resist'),
        # Swap to Dagger (#8) + Buckler (#9) -> stab zombie #10 with Poison Dagger!
        (406, c2s_swap_weapons(), '0x60 swap to Dagger + Buckler'),
        (410, c2s_sel_skill(73, True), 'select Poison Dagger (73)'),
        (411, c2s_l_unit(10, 1), 'stab zombie #10 with Poison Dagger'),
        # Poison & Bone spells
        (430, c2s_sel_skill(67, False), 'select Teeth (67)'),
        (431, c2s_r_loc(5661, 5795), 'cast Teeth'),
        (443, c2s_sel_skill(78, False), 'select Bone Wall (78)'),
        (444, c2s_r_loc(5656, 5796), 'cast Bone Wall'),
        (456, c2s_sel_skill(88, False), 'select Bone Prison (88)'),
        (457, c2s_r_unit(9, 1), 'cast Bone Prison around zombie #9'),
        (469, c2s_sel_skill(84, False), 'select Bone Spear (84)'),
        (470, c2s_r_unit(10, 1), 'cast Bone Spear at #10'),
        (484, c2s_sel_skill(93, False), 'select Bone Spirit (93)'),
        (485, c2s_r_unit(9, 1), 'cast Bone Spirit at #9'),
        (499, c2s_sel_skill(92, False), 'select Poison Nova (92)'),
        (500, c2s_r_loc(5662, 5798), 'cast Poison Nova'),
        # Step close to zombie-dropped metal Buckler (#11 at 5664, 5798) and cast Iron Golem (90) on it!
        (514, c2s_run(5662, 5800), 'step near zombie-dropped metal Buckler (#11)'),
        (530, c2s_sel_skill(90, False), 'select Iron Golem (90)'),
        (531, c2s_r_unit(11, 4), 'cast Iron Golem on ground metal Buckler (#11)!'),
        (548, c2s_sel_skill(75, False), 'select Clay Golem (75)'),
        (549, c2s_r_loc(5660, 5800), 'summon Clay Golem'),
        (563, c2s_sel_skill(85, False), 'select Blood Golem (85)'),
        (564, c2s_r_loc(5660, 5800), 'summon Blood Golem'),
        (578, c2s_sel_skill(94, False), 'select Fire Golem (94)'),
        (579, c2s_r_loc(5662, 5800), 'summon Fire Golem'),
        # Corpse skills targeting dead zombies #10 & #9 + Fallen corpses after walking north!
        (594, c2s_sel_skill(70, False), 'select Raise Skeleton (70)'),
        (595, c2s_r_unit(10, 1), 'Raise Skeleton from corpse #10'),
        (610, c2s_sel_skill(80, False), 'select Raise Skeletal Mage (80)'),
        (611, c2s_r_unit(9, 1), 'Raise Skeletal Mage from corpse #9'),
        # Walk north-east to Fallen camp (5702, 5762) to kill 3 Fallens for CE + PE + Revive!
        (626, c2s_run(5676, 5782), 'run toward Fallen camp'),
        (652, c2s_run(5698, 5766), 'arrive near Fallen camp'),
        (676, c2s_sel_skill(92, False), 'select Poison Nova at Fallen camp'),
        (677, c2s_r_loc(5707, 5759), 'cast Poison Nova on Fallens'),
        (691, c2s_sel_skill(84, False), 'select Bone Spear'),
        (692, c2s_r_loc(5707, 5759), 'Bone Spear into Fallens'),
        (706, c2s_r_loc(5710, 5759), 'Bone Spear 2 into Fallens'),
        (722, c2s_sel_skill(74, False), 'select Corpse Explosion (74)'),
        (723, c2s_r_loc(5707, 5759), 'cast Corpse Explosion on Fallen corpse'),
        (738, c2s_sel_skill(83, False), 'select Poison Explosion (83)'),
        (739, c2s_r_loc(5710, 5759), 'cast Poison Explosion on Fallen corpse'),
        (754, c2s_sel_skill(95, False), 'select Revive (95)'),
        (755, c2s_r_loc(5707, 5759), 'cast Revive on Fallen corpse'),
    ]
    for f, pkt, note in casts:
        inputs.append({'frame': f, 'c2s': pkt, 'note': note})

    scn = {
        'name': 'k6s2-necromancer-skills',
        'description': (
            'Level 45 Necromancer all-3-tree scenario: learns all 30 Necromancer skills (66..95 in prerequisite order), '
            'casts all 10 Curses, Poison Dagger/Explosion/Nova, Teeth/Bone Armor/Wall/Prison/Spear/Spirit, '
            'Corpse Explosion, Clay/Blood/Fire/Iron Golems (dropping metal Buckler for Iron Golem), Raise Skeleton/Mage, and Revive.'
        ),
        'seed': 12345,
        'save': 'tests/fixtures/oracle/k6-s2/saves/k6s2-necromancer-skills.d2s',
        'difficulty': 0,
        'frames': 775,
        'statIds': STAT_IDS,
        'oracleSetExp': [2, 31000000],
        'oracleSetGold': [2, 250000],
        'oracleEquip': [
            [2, 'dgr', 11, 6, 40],
            [2, 'buc', 12, 6, 40],
            [2, 'cap', 1, 6, 40],
        ],
        'oracleSnapshot': [2],
        'inputs': inputs,
    }
    return save_bytes, scn


def build_paladin_skills_scenario() -> tuple[bytes, dict]:
    save_bytes = make_new_char_d2s(3)  # Paladin (starts with Short Sword + Buckler)
    inputs: list[dict] = [
        {'frame': 4, 'c2s': c2s_add_stat(0, 60), 'note': '+60 Strength'},
        {'frame': 5, 'c2s': c2s_add_stat(1, 70), 'note': '+70 Energy'},
        {'frame': 6, 'c2s': c2s_add_stat(2, 40), 'note': '+40 Dexterity'},
        {'frame': 7, 'c2s': c2s_add_stat(3, 50), 'note': '+50 Vitality'},
    ]
    fr = 8
    for sid in range(96, 126):
        inputs.append({'frame': fr, 'c2s': c2s_add_skill(sid), 'note': f'learn Paladin skill {sid}'})
        fr += 1
    inputs.extend([
        {'frame': 38, 'c2s': c2s_sel_skill(117, False), 'note': 'select Holy Shield (117)'},
        {'frame': 39, 'c2s': c2s_r_loc(5653, 5918), 'note': 'cast Holy Shield in town'},
        {'frame': 48, 'c2s': c2s_sel_skill(115, False), 'note': 'activate Vigor aura (115)'},
    ])
    inputs.extend(blood_moor_route(50))  # arrives (5662, 5802) cleanly by F270 (with Vigor)!
    casts = [
        # MELEE COMBAT FIRST on live zombies #10, #9, #11 before AoE auras kill them!
        (268, c2s_sel_skill(107, True), 'select Charge (107)'),
        (269, c2s_l_unit(10, 1), 'Charge into live zombie #10!'),
        (288, c2s_sel_skill(97, True), 'select Smite (97)'),
        (289, c2s_l_unit(10, 1), 'Smite shield-bash zombie #10'),
        (304, c2s_sel_skill(96, True), 'select Sacrifice (96)'),
        (305, c2s_l_unit(10, 1), 'Sacrifice strike zombie #10 (self-damage -> HP < max for Redemption!)'),
        (320, c2s_sel_skill(116, True), 'select Conversion (116)'),
        (321, c2s_l_unit(9, 1), 'Conversion strike zombie #9'),
        (336, c2s_sel_skill(106, True), 'select Zeal (106)'),
        (337, c2s_l_unit(9, 1), 'Zeal multi-strike zombie #9'),
        (358, c2s_sel_skill(111, True), 'select Vengeance (111)'),
        (359, c2s_l_unit(9, 1), 'Vengeance elemental strike zombie #9'),
        # Distance combat spells + Offensive/Defensive pulse auras
        (374, c2s_sel_skill(102, False), 'activate Holy Fire aura (102)'),
        (376, c2s_sel_skill(101, True), 'select Holy Bolt (101)'),
        (377, c2s_l_unit(11, 1), 'cast Holy Bolt at undead zombie #11'),
        (392, c2s_sel_skill(112, True), 'select Blessed Hammer (112)'),
        (393, c2s_l_loc(5661, 5795), 'cast Blessed Hammer'),
        (408, c2s_sel_skill(121, True), 'select Fist of the Heavens (121, delay 25f)'),
        (409, c2s_l_unit(11, 1), 'cast Fist of the Heavens at #11'),
        # Pulse auras (56f each while standing near corpses / zombies)
        (432, c2s_sel_skill(114, False), 'activate Holy Freeze aura (114)'),
        (488, c2s_sel_skill(118, False), 'activate Holy Shock aura (118)'),
        (544, c2s_sel_skill(119, False), 'activate Sanctuary aura (119)'),
        (600, c2s_sel_skill(123, False), 'activate Conviction aura (123)'),
        # Redemption aura over fresh zombie corpses #9/#10 while HP/Mana < max!
        (656, c2s_sel_skill(124, False), 'activate Redemption aura (124)'),
        # Cycle remaining party/defensive auras
        (718, c2s_sel_skill(98, False), 'Might (98)'),
        (722, c2s_sel_skill(99, False), 'Prayer (99)'),
        (726, c2s_sel_skill(100, False), 'Resist Fire (100)'),
        (730, c2s_sel_skill(103, False), 'Thorns (103)'),
        (734, c2s_sel_skill(104, False), 'Defiance (104)'),
        (738, c2s_sel_skill(105, False), 'Resist Cold (105)'),
        (742, c2s_sel_skill(108, False), 'Blessed Aim (108)'),
        (746, c2s_sel_skill(109, False), 'Cleansing (109)'),
        (750, c2s_sel_skill(110, False), 'Resist Lightning (110)'),
        (754, c2s_sel_skill(113, False), 'Concentration (113)'),
        (758, c2s_sel_skill(120, False), 'Meditation (120)'),
        (762, c2s_sel_skill(122, False), 'Fanaticism (122)'),
        (766, c2s_sel_skill(125, False), 'Salvation (125)'),
    ]
    for f, pkt, note in casts:
        inputs.append({'frame': f, 'c2s': pkt, 'note': note})

    scn = {
        'name': 'k6s2-paladin-skills',
        'description': (
            'Level 45 Paladin all-3-tree scenario (weapon + shield): learns all 30 Paladin skills (96..125), '
            'casts Holy Shield, executes all Combat skills on live zombies (Charge, Smite, Sacrifice, Conversion, '
            'Zeal, Vengeance, Holy Bolt, Blessed Hammer, Fist of the Heavens), pulses all Offensive/Defensive periodic '
            'auras (Holy Fire, Holy Freeze, Holy Shock, Sanctuary, Conviction, Redemption on corpses), and cycles all party auras.'
        ),
        'seed': 12345,
        'save': 'tests/fixtures/oracle/k6-s2/saves/k6s2-paladin-skills.d2s',
        'difficulty': 0,
        'frames': 775,
        'statIds': STAT_IDS,
        'oracleSetExp': [2, 31000000],
        'oracleSetGold': [2, 250000],
        'oracleEquip': [
            [2, 'cap', 1, 6, 40],
            [2, 'lbl', 8, 6, 40],
            [2, 'rin', 6, 6, 40],
            [2, 'amu', 2, 7, 40],
        ],
        'oracleSnapshot': [2],
        'inputs': inputs,
    }
    return save_bytes, scn


def build_barbarian_skills_scenario() -> tuple[bytes, dict]:
    save_bytes = make_new_char_d2s(4)  # Barbarian
    inputs: list[dict] = [
        {'frame': 4, 'c2s': c2s_add_stat(0, 70), 'note': '+70 Strength'},
        {'frame': 5, 'c2s': c2s_add_stat(1, 60), 'note': '+60 Energy'},
        {'frame': 6, 'c2s': c2s_add_stat(2, 40), 'note': '+40 Dexterity'},
        {'frame': 7, 'c2s': c2s_add_stat(3, 50), 'note': '+50 Vitality'},
    ]
    fr = 8
    for sid in range(126, 156):
        inputs.append({'frame': fr, 'c2s': c2s_add_skill(sid), 'note': f'learn Barbarian skill {sid}'})
        fr += 1
    inputs.append({'frame': 38, 'c2s': c2s_swap_weapons(), 'note': '0x60 swap to dual Rare Javelins (melee + throw)'})
    inputs.extend(blood_moor_route(42))  # arrives cleanly at (5662, 5802) by F264!
    casts = [
        # Warcries buffs & debuffs right in front of zombies #9/#10/#11
        (266, c2s_sel_skill(155, False), 'select Battle Command (155)'),
        (267, c2s_r_loc(5662, 5802), 'cast Battle Command'),
        (281, c2s_sel_skill(149, False), 'select Battle Orders (149)'),
        (282, c2s_r_loc(5662, 5802), 'cast Battle Orders'),
        (296, c2s_sel_skill(138, False), 'select Shout (138)'),
        (297, c2s_r_loc(5662, 5802), 'cast Shout'),
        (311, c2s_sel_skill(146, False), 'select Battle Cry (146)'),
        (312, c2s_r_loc(5661, 5795), 'cast Battle Cry'),
        (326, c2s_sel_skill(137, False), 'select Taunt (137)'),
        (327, c2s_r_unit(10, 1), 'cast Taunt on zombie #10'),
        (341, c2s_sel_skill(130, False), 'select Howl (130)'),
        (342, c2s_r_loc(5661, 5795), 'cast Howl'),
        (356, c2s_sel_skill(154, False), 'select War Cry (154)'),
        (357, c2s_r_loc(5661, 5795), 'cast War Cry'),
        # Dual-throw, Leap, Leap Attack, Whirlwind on live zombies!
        (372, c2s_sel_skill(140, True), 'select Double Throw (140)'),
        (373, c2s_l_unit(10, 1), 'Double Throw dual javelins at zombie #10'),
        (392, c2s_sel_skill(132, False), 'select Leap (132)'),
        (393, c2s_r_loc(5662, 5796), 'Leap into zombies'),
        (422, c2s_sel_skill(143, False), 'select Leap Attack (143)'),
        (423, c2s_r_unit(9, 1), 'Leap Attack onto zombie #9'),
        (456, c2s_sel_skill(151, False), 'select Whirlwind (151)'),
        (457, c2s_r_loc(5660, 5788), 'Whirlwind spin across zombies'),
        # Dual-wield melee combat skills
        (492, c2s_sel_skill(126, True), 'select Bash (126)'),
        (493, c2s_l_unit(10, 1), 'Bash zombie #10'),
        (508, c2s_sel_skill(133, True), 'select Double Swing (133)'),
        (509, c2s_l_unit(10, 1), 'Double Swing zombie #10'),
        (524, c2s_sel_skill(139, True), 'select Stun (139)'),
        (525, c2s_l_unit(9, 1), 'Stun zombie #9'),
        (540, c2s_sel_skill(144, True), 'select Concentrate (144)'),
        (541, c2s_l_unit(9, 1), 'Concentrate zombie #9'),
        (556, c2s_sel_skill(147, True), 'select Frenzy (147)'),
        (557, c2s_l_unit(11, 1), 'Frenzy zombie #11'),
        (578, c2s_sel_skill(152, True), 'select Berserk (152)'),
        (579, c2s_l_unit(11, 1), 'Berserk zombie #11'),
        # Corpse Warcries targeting dead corpse units directly via 0x0D!
        (602, c2s_sel_skill(131, False), 'select Find Potion (131)'),
        (603, c2s_r_unit(10, 1), 'Find Potion on corpse #10'),
        (620, c2s_sel_skill(142, False), 'select Find Item (142)'),
        (621, c2s_r_unit(9, 1), 'Find Item on corpse #9'),
        (638, c2s_sel_skill(150, False), 'select Grim Ward (150)'),
        (639, c2s_r_unit(11, 1), 'Grim Ward on corpse #11'),
    ]
    for f, pkt, note in casts:
        inputs.append({'frame': f, 'c2s': pkt, 'note': note})

    scn = {
        'name': 'k6s2-barbarian-skills',
        'description': (
            'Level 45 Barbarian dual-wield/dual-throw all-3-tree scenario: learns all 30 Barbarian skills (126..155), '
            'swaps to dual Rare Javelins, casts all Warcries (Battle Command/Orders/Cry, Shout, Taunt, Howl, War Cry), '
            'executes Double Throw, Leap, Leap Attack, Whirlwind, Bash, Double Swing, Stun, Concentrate, Frenzy, Berserk, '
            'and targets corpses with Find Potion, Find Item, and Grim Ward.'
        ),
        'seed': 12345,
        'save': 'tests/fixtures/oracle/k6-s2/saves/k6s2-barbarian-skills.d2s',
        'difficulty': 0,
        'frames': 665,
        'statIds': STAT_IDS,
        'oracleSetExp': [2, 31000000],
        'oracleSetGold': [2, 250000],
        'oracleEquip': [
            [2, 'jav', 11, 6, 40],
            [2, 'jav', 12, 6, 40],
            [2, 'cap', 1, 6, 40],
            [2, 'lbl', 8, 6, 40],
        ],
        'oracleSnapshot': [2],
        'inputs': inputs,
    }
    return save_bytes, scn


def build_act2_sewers_cube_merc_scenario() -> tuple[bytes, dict]:
    # Act 2 Lut Gholein (Normal): Horadric Cube (#9) + 3 Chipped Amethysts (#10..#12 'gcv ' -> 'gfv ') +
    # 3 Rejuv Potions (#13..#15 'rvs ' -> 'rvl ') + 3 El Runes (#16..#18 'r01 ' -> 'r02 ')!
    # Existing items in paladin-l40-auras.d2s:
    #   #1..#4 hp1 (belt 0..3), #5 tsc (9,3), #6 isc (9,2), #7 weapon (slot 4), #8 shield (slot 5)
    # F2 oracleEquip adds: #19 cap (slot 1), #20 qui (slot 3) for merc equip!
    extras = [
        make_compact_jm('box ', 0, 0),
        make_compact_jm('gcv ', 2, 0),
        make_compact_jm('gcv ', 3, 0),
        make_compact_jm('gcv ', 4, 0),
        make_compact_jm('rvs ', 5, 0),
        make_compact_jm('rvs ', 6, 0),
        make_compact_jm('rvs ', 7, 0),
        make_compact_jm('r01 ', 2, 1),
        make_compact_jm('r01 ', 3, 1),
        make_compact_jm('r01 ', 4, 1),
    ]
    save_bytes = build_act_paladin_save(1, 0, {4: 0x0001, 9: 0x0004}, extras, unlock_all_waypoints=True)
    inputs: list[dict] = [
        # 1. Walk FIRST from F5 using exact verified Lut Gholein Town Square route (before NPCs wander into path!)
        {'frame': 4, 'c2s': c2s_quest_log(), 'note': '0x40 quest log in Act 2'},
        {'frame': 5, 'c2s': c2s_run(5149, 5189), 'note': 'route to Lut Gholein square 1'},
        {'frame': 25, 'c2s': c2s_run(5156, 5175), 'note': 'route to Lut Gholein square 2'},
        {'frame': 45, 'c2s': c2s_run(5157, 5161), 'note': 'route to Lut Gholein square 3'},
        {'frame': 70, 'c2s': c2s_run(5157, 5165), 'note': 'route to Lut Gholein square 4'},
        {'frame': 92, 'c2s': c2s_run(5157, 5151), 'note': 'route to Lut Gholein square 5'},
        {'frame': 114, 'c2s': c2s_run(5156, 5137), 'note': 'route to Lut Gholein square 6'},
        {'frame': 136, 'c2s': c2s_run(5155, 5123), 'note': 'route to Lut Gholein square 7'},
        {'frame': 158, 'c2s': c2s_run(5154, 5120), 'note': 'route to Lut Gholein square 8'},
        {'frame': 180, 'c2s': c2s_run(5140, 5118), 'note': 'route to Lut Gholein square 9'},
        {'frame': 202, 'c2s': c2s_run(5126, 5116), 'note': 'route to Lut Gholein square 10'},
        {'frame': 224, 'c2s': c2s_run(5112, 5102), 'note': 'arrive in Lut Gholein Town Square'},
        # 2. SwapContainer (0x1F) + SwapBelt (0x25) + ALL 3 REAL HORADRIC CUBE RECIPES (emptying output each time!)
        {'frame': 248, 'c2s': c2s_item_to_cursor(5), 'note': 'pick tsc (#5) to cursor'},
        {'frame': 250, 'c2s': c2s_swap_container(5, 6, 9, 2), 'note': '0x1F swap cursor tsc (#5) with inventory isc (#6)'},
        {'frame': 252, 'c2s': c2s_place_buf(6, 9, 3, 0), 'note': 'place isc (#6) into inventory'},
        {'frame': 254, 'c2s': c2s_item_to_cursor(13), 'note': 'pick rvs (#13) to cursor'},
        {'frame': 256, 'c2s': c2s_belt_swap(13, 1), 'note': '0x25 swap cursor rvs (#13) with belt hp1 (#1)'},
        {'frame': 258, 'c2s': c2s_belt_swap(1, 13), 'note': '0x25 swap belt rvs (#13) back with hp1 (#1)'},
        {'frame': 260, 'c2s': c2s_place_buf(13, 5, 0, 0), 'note': 'place rvs (#13) back in inventory'},
        # Recipe A: 3x Chipped Amethyst (#10, #11, #12) -> Flawed Amethyst (#21)!
        {'frame': 264, 'c2s': c2s_use_item(9, 5112, 5102), 'note': '0x20 open Horadric Cube (#9)'},
        {'frame': 266, 'c2s': c2s_item_to_cursor(10), 'note': 'pick gcv #10'},
        {'frame': 268, 'c2s': c2s_item_to_cube(10, 9), 'note': '0x2A put gcv #10 in Cube'},
        {'frame': 270, 'c2s': c2s_item_to_cursor(11), 'note': 'pick gcv #11'},
        {'frame': 272, 'c2s': c2s_item_to_cube(11, 9), 'note': '0x2A put gcv #11 in Cube'},
        {'frame': 274, 'c2s': c2s_item_to_cursor(12), 'note': 'pick gcv #12'},
        {'frame': 276, 'c2s': c2s_item_to_cube(12, 9), 'note': '0x2A put gcv #12 in Cube'},
        {'frame': 278, 'c2s': c2s_click_button(0x18, 0), 'note': '0x4F Transmute 3x gcv -> Flawed Amethyst (#21)!'},
        {'frame': 282, 'c2s': c2s_item_to_cursor(21), 'note': 'remove Flawed Amethyst (#21) from Cube'},
        {'frame': 284, 'c2s': c2s_place_buf(21, 2, 0, 0), 'note': 'place Flawed Amethyst (#21) into inventory'},
        # Recipe B: 3x Rejuv Potion (#13, #14, #15) -> Full Rejuv Potion (#22)!
        {'frame': 286, 'c2s': c2s_item_to_cursor(13), 'note': 'pick rvs #13'},
        {'frame': 288, 'c2s': c2s_item_to_cube(13, 9), 'note': 'put rvs #13 in Cube'},
        {'frame': 290, 'c2s': c2s_item_to_cursor(14), 'note': 'pick rvs #14'},
        {'frame': 292, 'c2s': c2s_item_to_cube(14, 9), 'note': 'put rvs #14 in Cube'},
        {'frame': 294, 'c2s': c2s_item_to_cursor(15), 'note': 'pick rvs #15'},
        {'frame': 296, 'c2s': c2s_item_to_cube(15, 9), 'note': 'put rvs #15 in Cube'},
        {'frame': 298, 'c2s': c2s_click_button(0x18, 0), 'note': '0x4F Transmute 3x rvs -> Full Rejuv (#22)!'},
        {'frame': 302, 'c2s': c2s_item_to_cursor(22), 'note': 'remove Full Rejuv (#22) from Cube'},
        {'frame': 304, 'c2s': c2s_place_buf(22, 3, 0, 0), 'note': 'place Full Rejuv (#22) into inventory'},
        # Recipe C: 3x El Rune (#16, #17, #18) -> Eld Rune (#23)!
        {'frame': 306, 'c2s': c2s_item_to_cursor(16), 'note': 'pick r01 #16'},
        {'frame': 308, 'c2s': c2s_item_to_cube(16, 9), 'note': 'put r01 #16 in Cube'},
        {'frame': 310, 'c2s': c2s_item_to_cursor(17), 'note': 'pick r01 #17'},
        {'frame': 312, 'c2s': c2s_item_to_cube(17, 9), 'note': 'put r01 #17 in Cube'},
        {'frame': 314, 'c2s': c2s_item_to_cursor(18), 'note': 'pick r01 #18'},
        {'frame': 316, 'c2s': c2s_item_to_cube(18, 9), 'note': 'put r01 #18 in Cube'},
        {'frame': 318, 'c2s': c2s_click_button(0x18, 0), 'note': '0x4F Transmute 3x El Rune -> Eld Rune (#23)!'},
        {'frame': 322, 'c2s': c2s_item_to_cursor(23), 'note': 'remove Eld Rune (#23) from Cube'},
        {'frame': 324, 'c2s': c2s_place_buf(23, 4, 0, 0), 'note': 'place Eld Rune (#23) into inventory'},
        {'frame': 326, 'c2s': c2s_click_button(0x17, 0), 'note': '0x4F Close Cube'},
        # 3. NPCs: Lysander (#11), Fara (#10), Deckard Cain (#9), Atma (#15), Elzix (#23), Greiz (#24)
        {'frame': 332, 'c2s': c2s_interact(11, 1), 'note': '0x13 Interact Lysander (#11)'},
        {'frame': 346, 'c2s': c2s_npc_init(11), 'note': '0x2F NpcInit Lysander'},
        {'frame': 350, 'c2s': c2s_npc_action(1, 11), 'note': '0x38 Open Lysander Trade'},
        {'frame': 356, 'c2s': c2s_npc_cancel(11), 'note': '0x30 NpcCancel Lysander'},
        # Fara (#10 at 5118, 5077): arrive at (5118, 5080) BEFORE interact -> Trade + Buy socketed weapon (#40) + RepairAll
        {'frame': 362, 'c2s': c2s_run(5118, 5080), 'note': 'step right next to Fara (#10)'},
        {'frame': 396, 'c2s': c2s_interact(10, 1), 'note': '0x13 Interact Fara (#10)'},
        {'frame': 408, 'c2s': c2s_npc_init(10), 'note': '0x2F NpcInit Fara'},
        {'frame': 412, 'c2s': c2s_npc_action(1, 10), 'note': '0x38 Open Fara Trade'},
        {'frame': 416, 'c2s': c2s_npc_buy(10, 40, 0, False, False, 0), 'note': '0x32 Buy socketed weapon (#40 -> #114) from Fara'},
        {'frame': 420, 'c2s': c2s_npc_repair_all(10), 'note': '0x35 RepairAll at Fara'},
        {'frame': 424, 'c2s': c2s_npc_cancel(10), 'note': '0x30 NpcCancel Fara'},
        # Socket Cube-transmuted Flawed Amethyst (#21) into purchased socketed weapon (#114) via 0x28!
        {'frame': 426, 'c2s': c2s_item_to_cursor(21), 'note': '0x19 pick Cube-transmuted Flawed Amethyst (#21) to cursor'},
        {'frame': 428, 'c2s': c2s_socket_item(21, 114), 'note': '0x28 Socket Flawed Amethyst (#21) into Fara weapon (#114)!'},
        # Deckard Cain (#9 at 5125, 5088): Identify All (0x34)
        {'frame': 432, 'c2s': c2s_run(5125, 5091), 'note': 'step right next to Deckard Cain (#9)'},
        {'frame': 456, 'c2s': c2s_interact(9, 1), 'note': '0x13 Interact Deckard Cain (#9)'},
        {'frame': 468, 'c2s': c2s_npc_init(9), 'note': '0x2F NpcInit Deckard Cain'},
        {'frame': 472, 'c2s': c2s_cain_identify(9), 'note': '0x34 CainIdentifyItems'},
        {'frame': 476, 'c2s': c2s_npc_cancel(9), 'note': '0x30 NpcCancel Cain'},
        # Atma (#15 at 5137, 5051) via verified BFS
        {'frame': 482, 'c2s': c2s_run(5119, 5076), 'note': 'route north to Atma 1'},
        {'frame': 506, 'c2s': c2s_run(5125, 5062), 'note': 'route north to Atma 2'},
        {'frame': 530, 'c2s': c2s_run(5134, 5053), 'note': 'arrive right next to Atma (#15)'},
        {'frame': 556, 'c2s': c2s_interact(15, 1), 'note': '0x13 Interact Atma (#15)'},
        {'frame': 568, 'c2s': c2s_npc_init(15), 'note': '0x2F NpcInit Atma'},
        {'frame': 572, 'c2s': c2s_npc_cancel(15), 'note': '0x30 NpcCancel Atma'},
        # Retrace cleanly to WP #26 (5073, 5081) via verified corridor (5112,5098) -> (5098,5098) -> (5087,5092) -> (5073,5081)!
        {'frame': 578, 'c2s': c2s_run(5128, 5075), 'note': 'retrace south-west from Atma 1'},
        {'frame': 604, 'c2s': c2s_run(5120, 5086), 'note': 'retrace south-west from Atma 2'},
        {'frame': 630, 'c2s': c2s_run(5112, 5098), 'note': 'step south to Lut Gholein plaza avenue'},
        {'frame': 656, 'c2s': c2s_run(5098, 5098), 'note': 'route west along south avenue 1'},
        {'frame': 682, 'c2s': c2s_run(5087, 5092), 'note': 'route west along south avenue 2'},
        {'frame': 708, 'c2s': c2s_run(5073, 5081), 'note': 'arrive at Lut Gholein WP #26'},
        # Elzix (#28 cls=199 at 5026, 5102) via verified BFS -> Gamble!
        {'frame': 736, 'c2s': c2s_run(5059, 5089), 'note': 'route to Elzix 1'},
        {'frame': 764, 'c2s': c2s_run(5045, 5088), 'note': 'route to Elzix 2'},
        {'frame': 792, 'c2s': c2s_run(5029, 5100), 'note': 'arrive right next to Elzix (#28)'},
        {'frame': 836, 'c2s': c2s_interact(28, 1), 'note': '0x13 Interact Elzix (#28)'},
        {'frame': 850, 'c2s': c2s_npc_init(28), 'note': '0x2F NpcInit Elzix'},
        {'frame': 854, 'c2s': c2s_npc_action(2, 28), 'note': '0x38 Open Elzix Gamble'},
        {'frame': 862, 'c2s': c2s_npc_cancel(28), 'note': '0x30 NpcCancel Elzix'},
        # Route north-east around Greiz's awning (5045,5088) -> (5048,5072) -> (5052,5058) -> (5042,5050) -> (5035,5048)!
        {'frame': 868, 'c2s': c2s_run(5045, 5088), 'note': 'step east to west lane'},
        {'frame': 896, 'c2s': c2s_run(5048, 5072), 'note': 'route north around awning 1'},
        {'frame': 924, 'c2s': c2s_run(5052, 5058), 'note': 'route north around awning 2'},
        {'frame': 952, 'c2s': c2s_run(5042, 5050), 'note': 'turn west into Greiz courtyard'},
        {'frame': 980, 'c2s': c2s_run(5035, 5048), 'note': 'arrive right next to Greiz (#29 at 5033, 5047)'},
        {'frame': 1012, 'c2s': c2s_interact(29, 1), 'note': '0x13 Interact Greiz (#29)'},
        {'frame': 1026, 'c2s': c2s_npc_init(29), 'note': '0x2F NpcInit Greiz'},
        {'frame': 1032, 'c2s': c2s_npc_action(3, 29), 'note': '0x38 Open Greiz Act 2 Desert Merc Hire list'},
        {'frame': 1040, 'c2s': c2s_hire_merc(29, 0x03FB), 'note': '0x36 Hire Act 2 Desert Mercenary (0x03FB)!'},
        {'frame': 1048, 'c2s': c2s_npc_cancel(29), 'note': '0x30 NpcCancel Greiz'},
        {'frame': 1054, 'c2s': c2s_unequip(1), 'note': '0x1C unequip Rare Cap (#19) to cursor'},
        {'frame': 1058, 'c2s': c2s_merc_item(1), 'note': '0x61 Equip Rare Cap onto Act 2 Desert Merc helm!'},
        {'frame': 1062, 'c2s': c2s_unequip(3), 'note': '0x1C unequip Rare Quilted Armor (#20) to cursor'},
        {'frame': 1066, 'c2s': c2s_merc_item(3), 'note': '0x61 Equip Rare Armor onto Act 2 Desert Merc torso!'},
        {'frame': 1070, 'c2s': c2s_belt_use(1, 1), 'note': '0x26 Shift+Belt heal Act 2 Desert Merc!'},
        # Return around awning -> WP #26 (5069, 5084) -> Sewers Level 2 (area 48) WITH hired Act 2 Desert Merc!
        {'frame': 1078, 'c2s': c2s_run(5046, 5053), 'note': 'retrace from Greiz 1'},
        {'frame': 1106, 'c2s': c2s_run(5058, 5066), 'note': 'retrace from Greiz 2'},
        {'frame': 1134, 'c2s': c2s_run(5072, 5082), 'note': 'arrive at Lut Gholein WP #26'},
        {'frame': 1166, 'c2s': c2s_interact(26, 2), 'note': '0x13 Interact Lut Gholein WP #26'},
        {'frame': 1182, 'c2s': c2s_waypoint(26, 48), 'note': '0x49 Waypoint -> Sewers Level 2 (area 48)'},
        {'frame': 1196, 'c2s': c2s_sel_skill(113, False), 'note': 'activate Concentration aura in Sewers L2'},
        {'frame': 1200, 'c2s': c2s_run(7528, 6650), 'note': 'advance into Sewers L2 with Act 2 Merc'},
        {'frame': 1226, 'c2s': c2s_sel_skill(106, True), 'note': 'select Zeal (106)'},
        {'frame': 1228, 'c2s': c2s_l_loc(7532, 6650), 'note': 'Zeal swing in Sewers L2 with Act 2 Merc'},
        {'frame': 1248, 'c2s': c2s_l_loc(7532, 6650), 'note': 'Zeal swing 2 in Sewers L2'},
    ]
    scn = {
        'name': 'k6s2-act2-sewers-cube-merc',
        'description': (
            'Act 2 Lut Gholein + Horadric Cube + Act 2 Desert Mercenary + Sewers L2 scenario: exercises SwapContainer (0x1F), '
            'SwapBeltItem (0x25), 3 real Horadric Cube recipes (3x Chipped Amethyst -> Flawed Amethyst, 3x Rejuv -> Full Rejuv, '
            '3x El Rune -> Eld Rune), Lysander/Fara (Trade/Buy socketed weapon + 0x28 Socket Gem + Repair)/Deckard Cain (0x34)/'
            'Atma/Elzix (Gamble)/Greiz (0x36 Hire Act 2 Desert Merc + 0x61 Equip Helm & Armor + 0x26 Shift-Heal), '
            'Waypoint (0x49) to Sewers Level 2 (area 48) with Desert Merc, and Sewers combat.'
        ),
        'seed': 12345,
        'save': 'tests/fixtures/oracle/k6-s2/saves/k6s2-act2-sewers-cube-merc.d2s',
        'difficulty': 0,
        'frames': 1290,
        'statIds': STAT_IDS,
        'oracleSetGold': [2, 350000],
        'oracleEquip': [
            [2, 'cap', 1, 6, 40],
            [2, 'qui', 3, 6, 40],
        ],
        'oracleSnapshot': [2],
        'inputs': inputs,
    }
    return save_bytes, scn


def build_act4_hell_chaos_shrines_scenario() -> tuple[bytes, dict]:
    # Hell difficulty (difficulty = 2) Level 86 Paladin in Act 4 Pandemonium Fortress -> River of Flame WP!
    save_bytes = build_act_paladin_save(3, 2, {4: 0x0001}, (), unlock_all_waypoints=True)
    inputs: list[dict] = [
        {'frame': 3, 'c2s': c2s_add_stat(0, 60), 'note': '+60 Strength'},
        {'frame': 4, 'c2s': c2s_add_stat(2, 40), 'note': '+40 Dexterity'},
        {'frame': 5, 'c2s': c2s_add_stat(3, 100), 'note': '+100 Vitality'},
        {'frame': 6, 'c2s': c2s_add_stat(1, 30), 'note': '+30 Energy (230/230 L86 stat pts)'},
        {'frame': 7, 'c2s': c2s_quest_log(), 'note': '0x40 Hell quest log'},
        {'frame': 8, 'c2s': c2s_add_skill(101), 'note': 'learn Holy Bolt'},
        {'frame': 9, 'c2s': c2s_add_skill(112), 'note': 'learn Blessed Hammer'},
        {'frame': 10, 'c2s': c2s_add_skill(97), 'note': 'learn Smite'},
        {'frame': 11, 'c2s': c2s_add_skill(107), 'note': 'learn Charge'},
        {'frame': 12, 'c2s': c2s_add_skill(117), 'note': 'learn Holy Shield'},
        {'frame': 14, 'c2s': c2s_sel_skill(117, False), 'note': 'select Holy Shield'},
        {'frame': 15, 'c2s': c2s_r_loc(5048, 5043), 'note': 'cast Holy Shield in Hell'},
        # 1. Pandemonium Fortress NPCs via verified BFS: Tyrael (#3), Cain (#4), Halbu (#2), Jamella (#1)
        {'frame': 24, 'c2s': c2s_run(5034, 5030), 'note': 'BFS to Tyrael 1'},
        {'frame': 48, 'c2s': c2s_run(5024, 5020), 'note': 'BFS to Tyrael 2'},
        {'frame': 74, 'c2s': c2s_interact(3, 1), 'note': '0x13 Interact Tyrael (#3)'},
        {'frame': 86, 'c2s': c2s_npc_init(3), 'note': '0x2F NpcInit Tyrael'},
        {'frame': 90, 'c2s': c2s_npc_cancel(3), 'note': '0x30 NpcCancel Tyrael'},
        {'frame': 96, 'c2s': c2s_interact(4, 1), 'note': '0x13 Interact Deckard Cain (#4)'},
        {'frame': 108, 'c2s': c2s_npc_init(4), 'note': '0x2F NpcInit Cain'},
        {'frame': 112, 'c2s': c2s_cain_identify(4), 'note': '0x34 CainIdentifyItems'},
        {'frame': 116, 'c2s': c2s_npc_cancel(4), 'note': '0x30 NpcCancel Cain'},
        # Halbu (#2) & Jamella (#1) via verified BFS around central pillar!
        {'frame': 122, 'c2s': c2s_run(5048, 5043), 'note': 'return to center clearing'},
        {'frame': 152, 'c2s': c2s_run(5062, 5034), 'note': 'BFS east to Halbu 1'},
        {'frame': 176, 'c2s': c2s_run(5076, 5035), 'note': 'BFS east to Halbu 2'},
        {'frame': 200, 'c2s': c2s_run(5079, 5027), 'note': 'arrive at Halbu (#2)'},
        {'frame': 226, 'c2s': c2s_interact(2, 1), 'note': '0x13 Interact Halbu (#2)'},
        {'frame': 238, 'c2s': c2s_npc_init(2), 'note': '0x2F NpcInit Halbu'},
        {'frame': 242, 'c2s': c2s_npc_action(1, 2), 'note': '0x38 Open Halbu Trade'},
        {'frame': 248, 'c2s': c2s_npc_repair_all(2), 'note': '0x35 RepairAll at Halbu'},
        {'frame': 252, 'c2s': c2s_npc_cancel(2), 'note': '0x30 NpcCancel Halbu'},
        {'frame': 258, 'c2s': c2s_run(5076, 5047), 'note': 'BFS south to Jamella 1'},
        {'frame': 284, 'c2s': c2s_run(5089, 5058), 'note': 'arrive within 3 tiles of Jamella (#1 at 5092, 5059)'},
        {'frame': 314, 'c2s': c2s_interact(1, 1), 'note': '0x13 Interact Jamella (#1)'},
        {'frame': 330, 'c2s': c2s_npc_init(1), 'note': '0x2F NpcInit Jamella'},
        {'frame': 336, 'c2s': c2s_npc_action(2, 1), 'note': '0x38 Open Jamella Hell Gamble'},
        {'frame': 340, 'c2s': c2s_npc_buy(1, 95, 0, True, False, 0), 'note': '0x32 Gamble Amulet (#95 -> #108) from Jamella in Hell!'},
        {'frame': 346, 'c2s': c2s_npc_cancel(1), 'note': '0x30 NpcCancel Jamella'},
        {'frame': 350, 'c2s': c2s_use_item(6, 5089, 5058), 'note': '0x20 Use Scroll of Identify (#6) for Hell gambled Amulet'},
        {'frame': 352, 'c2s': c2s_identify_item(108, 6), 'note': '0x27 Identify Hell gambled Amulet (#108) with Scroll (#6)!'},
        # 2. Waypoint #18 (5044, 5019) via verified BFS -> Hell River of Flame (area 107)!
        {'frame': 358, 'c2s': c2s_run(5076, 5047), 'note': 'retrace north-west from Jamella'},
        {'frame': 384, 'c2s': c2s_run(5062, 5034), 'note': 'back west past center'},
        {'frame': 410, 'c2s': c2s_run(5048, 5043), 'note': 'center clearing'},
        {'frame': 436, 'c2s': c2s_run(5036, 5029), 'note': 'BFS to WP #18 1'},
        {'frame': 460, 'c2s': c2s_run(5040, 5023), 'note': 'arrive at Pandemonium WP #18'},
        {'frame': 486, 'c2s': c2s_interact(18, 2), 'note': '0x13 Interact Pandemonium WP #18'},
        {'frame': 502, 'c2s': c2s_waypoint(18, 107), 'note': '0x49 Waypoint -> Hell River of Flame (107)'},
        # 3. FIRST go NORTH (safe!) to Hell Shrine #50 (7776, 5915) & Hadriel (#5 at 7800, 5870)!
        {'frame': 514, 'c2s': c2s_sel_skill(113, False), 'note': 'activate Concentration aura in Hell'},
        {'frame': 518, 'c2s': c2s_run(7790, 5916), 'note': 'step west toward Hell Shrine #50'},
        {'frame': 544, 'c2s': c2s_run(7778, 5915), 'note': 'arrive right next to Hell Shrine #50 (7776, 5915)'},
        {'frame': 570, 'c2s': c2s_interact(50, 2), 'note': '0x13 Activate Hell Shrine #50!'},
        {'frame': 582, 'c2s': c2s_run(7786, 5898), 'note': 'BFS north to Hadriel 1'},
        {'frame': 608, 'c2s': c2s_run(7794, 5884), 'note': 'BFS north to Hadriel 2'},
        {'frame': 634, 'c2s': c2s_run(7798, 5873), 'note': 'arrive right next to Hadriel (#5 at 7800, 5870)'},
        {'frame': 662, 'c2s': c2s_interact(5, 1), 'note': '0x13 Interact Hadriel (#5)'},
        {'frame': 674, 'c2s': c2s_npc_init(5), 'note': '0x2F NpcInit Hadriel'},
        {'frame': 680, 'c2s': c2s_npc_cancel(5), 'note': '0x30 NpcCancel Hadriel'},
        # 4. Retrace south past RoF WP to Hell Shrine #47 (7805, 5955) + Hell combat + Death + 0x41 Resurrect!
        {'frame': 686, 'c2s': c2s_run(7792, 5888), 'note': 'retrace south 1'},
        {'frame': 712, 'c2s': c2s_run(7792, 5904), 'note': 'retrace south 2'},
        {'frame': 738, 'c2s': c2s_run(7803, 5918), 'note': 'pass RoF WP'},
        {'frame': 764, 'c2s': c2s_run(7790, 5932), 'note': 'route south to Hell Shrine #47 1'},
        {'frame': 790, 'c2s': c2s_run(7796, 5946), 'note': 'route south to Hell Shrine #47 2'},
        {'frame': 816, 'c2s': c2s_run(7802, 5953), 'note': 'step next to Hell Shrine #47 (7805, 5955)'},
        {'frame': 840, 'c2s': c2s_interact(47, 2), 'note': '0x13 Activate Hell Shrine #47!'},
        {'frame': 854, 'c2s': c2s_run(7800, 5974), 'note': 'advance south toward Hell monsters'},
        {'frame': 880, 'c2s': c2s_run(7806, 5987), 'note': 'engage Hell Grotesque pack'},
        {'frame': 904, 'c2s': c2s_sel_skill(112, True), 'note': 'select Blessed Hammer (112)'},
        {'frame': 906, 'c2s': c2s_l_loc(7802, 5989), 'note': 'cast Blessed Hammer on Hell Grotesques'},
        {'frame': 924, 'c2s': c2s_l_loc(7802, 5989), 'note': 'Blessed Hammer 2'},
        {'frame': 942, 'c2s': c2s_sel_skill(122, False), 'note': 'switch aura to Fanaticism (122)'},
        {'frame': 946, 'c2s': c2s_sel_skill(106, True), 'note': 'select Zeal'},
        {'frame': 948, 'c2s': c2s_l_loc(7802, 5989), 'note': 'Zeal Hell Grotesques 1'},
        {'frame': 968, 'c2s': c2s_l_loc(7802, 5989), 'note': 'Zeal Hell Grotesques 2'},
        {'frame': 1210, 'c2s': c2s_resurrect(), 'note': '0x41 Resurrect in Pandemonium Fortress after Hell death (mode=17)!'},
    ]
    scn = {
        'name': 'k6s2-act4-hell-chaos-shrines',
        'description': (
            'Hell difficulty (difficulty=2) Act 4 Pandemonium Fortress -> River of Flame scenario: Level 86 Paladin '
            'interacts with Tyrael, Deckard Cain (0x34), Halbu (Trade/Repair), and Jamella (0x32 Hell Gamble Amulet + '
            '0x27 IdentifyItem), warps via Waypoint (0x49) to Hell River of Flame (area 107), activates Hell Shrines '
            '(#50, #47), speaks with Hadriel, battles Hell Sand Maggots/Grotesques/Maw Fiends, experiences Hell death + '
            'corpse drop, and resurrects back in Pandemonium Fortress via C2S 0x41.'
        ),
        'seed': 12345,
        'save': 'tests/fixtures/oracle/k6-s2/saves/k6s2-act4-hell-chaos-shrines.d2s',
        'difficulty': 2,
        'frames': 1225,
        'statIds': STAT_IDS,
        'oracleSetExp': [2, 1150000000],
        'oracleSetGold': [2, 500000],
        'oracleEquip': [
            [2, 'cap', 1, 6, 80],
            [2, 'qui', 3, 6, 80],
            [2, 'lbl', 8, 6, 80],
            [2, 'rin', 6, 6, 80],
            [2, 'amu', 2, 7, 80],
        ],
        'oracleSnapshot': [2],
        'inputs': inputs,
    }
    return save_bytes, scn


def build_act5_harrogath_shenk_anya_scenario() -> tuple[bytes, dict]:
    # Act 5 Harrogath (Normal): A5Q2 (word 36=0x0001) + A5Q3 (word 37=0x2001) so Anya & Qual-Kehk Merc Hire are active!
    save_bytes = build_act_paladin_save(4, 0, {4: 0x0001, 36: 0x0001, 37: 0x2001}, (), unlock_all_waypoints=True)
    inputs: list[dict] = [
        {'frame': 3, 'c2s': c2s_add_stat(0, 10), 'note': '+10 Strength'},
        {'frame': 4, 'c2s': c2s_add_stat(2, 5), 'note': '+5 Dexterity'},
        {'frame': 5, 'c2s': c2s_add_stat(3, 10), 'note': '+10 Vitality (25/25 L40->L45 stat pts)'},
        {'frame': 6, 'c2s': c2s_quest_log(), 'note': '0x40 Act 5 quest log'},
        # 1. Malah (#7 at 5080, 5028): Trade + Buy Tome of TP (#46) & Insert Scroll (0x29)!
        {'frame': 10, 'c2s': c2s_run(5084, 5026), 'note': 'step to Malah (#7)'},
        {'frame': 34, 'c2s': c2s_interact(7, 1), 'note': '0x13 Interact Malah (#7)'},
        {'frame': 46, 'c2s': c2s_npc_init(7), 'note': '0x2F NpcInit Malah'},
        {'frame': 50, 'c2s': c2s_npc_action(1, 7), 'note': '0x38 Open Malah Trade'},
        {'frame': 56, 'c2s': c2s_npc_buy(7, 46, 0, False, False, 400), 'note': '0x32 Buy Tome of Town Portal (#46) from Malah'},
        {'frame': 62, 'c2s': c2s_npc_cancel(7), 'note': '0x30 NpcCancel Malah'},
        {'frame': 66, 'c2s': c2s_item_to_cursor(5), 'note': 'pick tsc (#5) to cursor'},
        {'frame': 68, 'c2s': c2s_scroll_to_book(5, 59), 'note': '0x29 insert Scroll of TP (#5) into purchased Tome (#59)'},
        # 2. Return to spawn (5098, 5023) -> Larzuk (#1 at 5144, 5037) via verified BFS!
        {'frame': 72, 'c2s': c2s_run(5098, 5023), 'note': 'step back to spawn clearing'},
        {'frame': 98, 'c2s': c2s_run(5106, 5037), 'note': 'BFS east to Larzuk 1'},
        {'frame': 122, 'c2s': c2s_run(5120, 5037), 'note': 'BFS east to Larzuk 2'},
        {'frame': 146, 'c2s': c2s_run(5134, 5039), 'note': 'BFS east to Larzuk 3'},
        {'frame': 170, 'c2s': c2s_run(5141, 5036), 'note': 'arrive at Larzuk (#1)'},
        {'frame': 196, 'c2s': c2s_interact(1, 1), 'note': '0x13 Interact Larzuk (#1)'},
        {'frame': 208, 'c2s': c2s_npc_init(1), 'note': '0x2F NpcInit Larzuk'},
        {'frame': 212, 'c2s': c2s_npc_action(1, 1), 'note': '0x38 Open Larzuk Trade'},
        {'frame': 218, 'c2s': c2s_npc_repair_all(1), 'note': '0x35 RepairAll at Larzuk'},
        {'frame': 222, 'c2s': c2s_npc_cancel(1), 'note': '0x30 NpcCancel Larzuk'},
        # 3. Exact collision-grid Dijkstra path from Larzuk (5140, 5036) -> Qual-Kehk (#10 at 5064, 5077)!
        {'frame': 228, 'c2s': c2s_run(5135, 5048), 'note': 'Dijkstra Larzuk->Qual-Kehk 1'},
        {'frame': 254, 'c2s': c2s_run(5124, 5059), 'note': 'Dijkstra Larzuk->Qual-Kehk 2'},
        {'frame': 280, 'c2s': c2s_run(5112, 5070), 'note': 'Dijkstra Larzuk->Qual-Kehk 3 (past WP #5)'},
        {'frame': 306, 'c2s': c2s_run(5100, 5074), 'note': 'Dijkstra Larzuk->Qual-Kehk 4'},
        {'frame': 332, 'c2s': c2s_run(5088, 5074), 'note': 'Dijkstra Larzuk->Qual-Kehk 5'},
        {'frame': 358, 'c2s': c2s_run(5076, 5074), 'note': 'Dijkstra Larzuk->Qual-Kehk 6'},
        {'frame': 384, 'c2s': c2s_run(5060, 5077), 'note': 'arrive within 3 tiles of Qual-Kehk (#10 at 5057, 5078)'},
        {'frame': 416, 'c2s': c2s_interact(10, 1), 'note': '0x13 Interact Qual-Kehk (#10)'},
        {'frame': 430, 'c2s': c2s_npc_init(10), 'note': '0x2F NpcInit Qual-Kehk'},
        {'frame': 436, 'c2s': c2s_npc_action(3, 10), 'note': '0x38 Open Qual-Kehk Hire list'},
        {'frame': 444, 'c2s': c2s_hire_merc(10, 0x2A57), 'note': '0x36 Hire Act 5 Barbarian Mercenary (0x2A57)!'},
        {'frame': 452, 'c2s': c2s_npc_cancel(10), 'note': '0x30 NpcCancel Qual-Kehk'},
        {'frame': 458, 'c2s': c2s_unequip(1), 'note': '0x1C unequip Rare Cap (#9) to cursor'},
        {'frame': 464, 'c2s': c2s_merc_item(1), 'note': '0x61 Equip Rare Cap onto Act 5 Barbarian Merc helm!'},
        {'frame': 470, 'c2s': c2s_belt_use(1, 1), 'note': '0x26 Shift+Belt heal Act 5 Barbarian Merc!'},
        # 4. Deckard Cain (#9 at 5079, 5091) -> Identify All (0x34) + Anya (#8 at 5106, 5115) -> Gamble!
        {'frame': 478, 'c2s': c2s_run(5079, 5088), 'note': 'step right next to Deckard Cain (#9)'},
        {'frame': 510, 'c2s': c2s_interact(9, 1), 'note': '0x13 Interact Cain (#9)'},
        {'frame': 522, 'c2s': c2s_npc_init(9), 'note': '0x2F NpcInit Cain'},
        {'frame': 526, 'c2s': c2s_cain_identify(9), 'note': '0x34 CainIdentifyItems'},
        {'frame': 530, 'c2s': c2s_npc_cancel(9), 'note': '0x30 NpcCancel Cain'},
        # 5. Route cleanly via verified Harrogath plaza -> WP #5 (5111, 5066) -> Frigid Highlands (area 111) WITH hired Barbarian Merc!
        {'frame': 536, 'c2s': c2s_run(5088, 5074), 'note': 'route east from Cain 1'},
        {'frame': 564, 'c2s': c2s_run(5100, 5074), 'note': 'route east from Cain 2'},
        {'frame': 592, 'c2s': c2s_run(5111, 5068), 'note': 'arrive right next to Harrogath WP #5 (5114, 5069)'},
        {'frame': 622, 'c2s': c2s_interact(5, 2), 'note': '0x13 Interact Harrogath WP #5'},
        {'frame': 638, 'c2s': c2s_waypoint(5, 111), 'note': '0x49 Waypoint -> Frigid Highlands (area 111)'},
        # Run north via verified BFS into SuperUnique Eldritch the Rectifier + 8 Enslaved + Siege Beast + Demon Imps!
        {'frame': 650, 'c2s': c2s_sel_skill(122, False), 'note': 'activate Fanaticism aura (buffs Paladin + Barb Merc!)'},
        {'frame': 654, 'c2s': c2s_run(3764, 5094), 'note': 'BFS north to Eldritch 1'},
        {'frame': 680, 'c2s': c2s_run(3750, 5080), 'note': 'BFS north to Eldritch 2'},
        {'frame': 706, 'c2s': c2s_run(3736, 5066), 'note': 'engage Eldritch + Enslaved + Siege Beast + Imps!'},
        {'frame': 732, 'c2s': c2s_sel_skill(106, True), 'note': 'select Zeal'},
        {'frame': 734, 'c2s': c2s_l_loc(3729, 5059), 'note': 'Zeal Eldritch pack 1'},
        {'frame': 758, 'c2s': c2s_l_loc(3729, 5059), 'note': 'Zeal Eldritch pack 2'},
        {'frame': 782, 'c2s': c2s_l_loc(3728, 5048), 'note': 'engage Siege Beast & Demon Imps'},
        {'frame': 806, 'c2s': c2s_use_item(59, 3748, 5078), 'note': '0x20 cast Town Portal from Tome (#59) in Frigid Highlands'},
        {'frame': 826, 'c2s': c2s_interact(58, 2), 'note': '0x13 Enter Town Portal (#58) back to Harrogath!'},
    ]
    scn = {
        'name': 'k6s2-act5-harrogath-shenk-anya',
        'description': (
            'Act 5 Harrogath + Frigid Highlands scenario: interacts with Malah (Trade + 0x32 Buy Tome + 0x29 ScrollToBook), '
            'Larzuk (Trade/Repair), Qual-Kehk (0x36 Hire Act 5 Barbarian Merc + 0x61 Equip + 0x26 Shift-Heal), and Deckard Cain (0x34), '
            'warps via Waypoint (0x49) with hired Barbarian Merc to Frigid Highlands (area 111), battles SuperUnique Eldritch '
            'the Rectifier + Enslaved + Siege Beast + Demon Imps, opens a Town Portal from Tome (0x20), and returns via TP.'
        ),
        'seed': 12345,
        'save': 'tests/fixtures/oracle/k6-s2/saves/k6s2-act5-harrogath-shenk-anya.d2s',
        'difficulty': 0,
        'frames': 860,
        'statIds': STAT_IDS,
        'oracleSetExp': [2, 31000000],
        'oracleSetGold': [2, 350000],
        'oracleEquip': [
            [2, 'cap', 1, 6, 40],
            [2, 'lbl', 8, 6, 40],
        ],
        'oracleSnapshot': [2],
        'inputs': inputs,
    }
    return save_bytes, scn


BUILDERS = [
    build_amazon_skills_scenario,
    build_sorceress_skills_scenario,
    build_necromancer_skills_scenario,
    build_paladin_skills_scenario,
    build_barbarian_skills_scenario,
    build_act2_sewers_cube_merc_scenario,
    build_act4_hell_chaos_shrines_scenario,
    build_act5_harrogath_shenk_anya_scenario,
]


def run_headless_capture(oracle_root: str, save_path: str, scenario_obj: dict, with_cover: bool) -> tuple[bytes, bytes, bytes]:
    wine_bin_dir = os.path.join(oracle_root, 'wine', 'root', 'usr', 'lib', 'x86_64-linux-gnu', 'wine')
    build_dir = os.path.join(oracle_root, 'build')
    manifest_path = os.path.join(REPO, 'tools', 'oracle', 'callgraph', 'manifest-113c.json')
    manifest_fns = json.load(open(manifest_path, encoding='utf-8'))['functions']

    tmp_base = os.environ.get('TMPDIR', os.path.join(os.path.expanduser('~'), '.cache', 'd2oracle-runs'))
    os.makedirs(tmp_base, exist_ok=True)
    pfx = tempfile.mkdtemp(prefix='d2host-k6s2-', dir=tmp_base)
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
    os.makedirs(FIX_DIR, exist_ok=True)
    os.makedirs(SAVES_DIR, exist_ok=True)

    oracle_root = os.environ.get(
        'D2_ORACLE_ROOT',
        os.path.join(os.path.expanduser('~'), '.local', 'opt', 'd2oracle'),
    )
    if args.record:
        build_dir = os.path.join(oracle_root, 'build')
        if not os.path.exists(os.path.join(build_dir, 'd2host-113c.exe')):
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
            if int(cov_hdr.get('otherThreadHits', -1)) != 0:
                raise RuntimeError(f"{name}: non-zero otherThreadHits={cov_hdr.get('otherThreadHits')}")
            golden_gz = gzip_deterministic(trace1)
            snap_gz = gzip_deterministic(snap1)
            cov_gz = gzip_deterministic(cov1)

            with open(os.path.join(FIX_DIR, f'{name}.oracle.ndjson.gz'), 'wb') as fg:
                fg.write(golden_gz)
            with open(os.path.join(FIX_DIR, f'{name}.snap-f002.ndjson.gz'), 'wb') as fsn:
                fsn.write(snap_gz)
            with open(os.path.join(FIX_DIR, f'{name}.coverage.ndjson.gz'), 'wb') as fc:
                fc.write(cov_gz)

            print(
                f'recorded {name:32s} frames={scn["frames"]:3d} rc={rc_counts} '
                f'hits={cov_hdr["hit"]:4d} other={cov_hdr["otherThreadHits"]} '
                f'golden={len(golden_gz):6d}B snap={len(snap_gz):6d}B cov={len(cov_gz):5d}B',
                flush=True,
            )
        else:
            print(f'wrote {name}.json and {name}.d2s ({len(save_bytes)}B)')


if __name__ == '__main__':
    main()

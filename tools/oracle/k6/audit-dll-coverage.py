#!/usr/bin/env python3
"""Deterministic [K6] Real-DLL Coverage Audit CLI for D2Common.dll & D2Game.dll (v1.13c).

Scans:
  1. All `.coverage.ndjson.gz` files across `tests/fixtures/oracle/{k1,k3,k4,k6*}/**`
  2. All real-DLL vector emitters in `tools/oracle/vectors/*.c` (+ `requests/*.req.json`)
     and `tools/oracle/k6*/*.c` (extracting target VAs invoked against real
     `D2Common.dll` and `D2Game.dll`, strictly excluding hooked/patched-out stubs).

Computes honest, non-inflated [K6] real-DLL metrics against `manifest-113c.json`:
  - D2Common (`1,479` functions): scenario VAs, emitter VAs, combined VAs, remaining VAs
  - D2Game (`3,331` functions): scenario VAs (baseline vs K6), emitter VAs (baseline vs K6),
    combined real-DLL-verified VAs, and remaining un-hit VAs grouped into 9 subsystems:
      1. C2S
      2. Skills
      3. Missiles
      4. MonAI
      5. Combat/SUnitDmg
      6. Items/Cube/Trade
      7. Quests
      8. DRLG/Room/SUnit
      9. Party/Player/Client

Usage:
  python3 tools/oracle/k6/audit-dll-coverage.py [--json]
"""
import argparse
import glob
import gzip
import json
import os
import re
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))

SUBSYSTEM_ORDER = (
    'C2S',
    'Skills',
    'Missiles',
    'MonAI',
    'Combat/SUnitDmg',
    'Items/Cube/Trade',
    'Quests',
    'DRLG/Room/SUnit',
    'Party/Player/Client',
)

# Canonical 1.13c D2Common.dll export ordinal -> preferred-base VA mapping for
# `GetProcAddress(hCom*, MAKEINTRESOURCEA(ord))` calls in `tools/oracle/vectors/*.c`.
D2COMMON_ORDINAL_TO_VA = {
    10014: 0x6FD5F2C0,
    10090: 0x6FD9EA00,
    10102: 0x6FD9E6D0,
    10121: 0x6FDA0460,
    10147: 0x6FDA1070,
    10188: 0x6FD87AB0,
    10207: 0x6FD5ECC0,
    10286: 0x6FD86260,
    10297: 0x6FDA1FF0,
    10302: 0x6FDA0320,
    10306: 0x6FDA05C0,
    10322: 0x6FD5ED80,
    10334: 0x6FD86820,
    10510: 0x6FD9E900,
    10567: 0x6FDA2100,
    10647: 0x6FD86200,
    10653: 0x6FD9EA50,
    10708: 0x6FD9FEA0,
    10775: 0x6FD51450,
    10785: 0x6FD88B50,
    10786: 0x6FDA1BF0,
    10807: 0x6FD88730,
    10856: 0x6FD9FE10,
    10868: 0x6FD57770,
    10887: 0x6FD8A740,
    10943: 0x6FD96EC0,
    10945: 0x6FD88890,
    10951: 0x6FD574E0,
    10973: 0x6FD88B70,
    11003: 0x6FD860C0,
    11008: 0x6FDA0EA0,
    11013: 0x6FD889F0,
    11016: 0x6FD57990,
    11091: 0x6FDA0360,
    11120: 0x6FDA00C0,
    11146: 0x6FDA0560,
    11166: 0x6FD87CD0,
}

HEX_VA_RE = re.compile(r'0x6F[CD][0-9A-Fa-f]{5}(?=[uUlL]*\b)')
COM_ORD_RE = re.compile(r'GetProcAddress\(\s*hCom\w*\s*,\s*MAKEINTRESOURCEA\(\s*(\d+)\s*\)')


def classify_d2game_subsystem(fn: dict) -> str:
    name = fn['name']
    pfx = name.split('_')[0]
    upper = name.upper()

    if pfx == 'C2S':
        return 'C2S'
    if pfx in ('SKILLS', 'SrvDoFunc', 'AURA', 'AURAS', 'CURSES', 'PALADIN', 'PETS', 'SUMMON', 'PETTYPE'):
        return 'Skills'
    if pfx in ('MISSILE', 'MISSILES') or upper.startswith('MISSMODE_'):
        return 'Missiles'
    if pfx in ('AI', 'MONAI', 'AIGENERAL', 'AIBAAL', 'AITARGET', 'AITHINK', 'AIINIT', 'AiFallen', 'AiZombie', 'SUNITPROXY'):
        return 'MonAI'
    if pfx in ('SUNITDMG', 'MONUMOD', 'MONSTER', 'MONMODE', 'MONSTATS', 'MONSTATS2', 'MONPROP', 'MONLVL', 'MONSEQ', 'MONTYPE', 'STATES', 'STATLIST', 'HIRELING'):
        return 'Combat/SUnitDmg'
    if pfx in ('ITEMS', 'ITEMMODS', 'ITEMEVENT', 'ITEMMODE', 'CUBE', 'PLRTRADE', 'NPCS', 'NPC', 'NPCTRADE', 'STASH', 'INVENTORY', 'UNIQUEITEMS'):
        return 'Items/Cube/Trade'
    if pfx in ('QUESTS', 'QUEST', 'QUEST0D', 'ACT2Intro', 'ACT4Prologue', 'ACT5Intro') or re.match(r'^(ACT[1-5](Q\d+)?|A5Q\d+)$', pfx):
        return 'Quests'
    if pfx in ('DRLG', 'DUNGEON', 'ROOM', 'REGPOP', 'REGIONS', 'MONREG', 'OBJRGN', 'OBJECTS', 'OBJ', 'OBJECT', 'SHRINES', 'PORTAL', 'SUNIT', 'UNIT', 'UNITS', 'UNITROOM', 'UNITMSG', 'SUNITMSG', 'UNITEVENT', 'EVENT', 'SEED', 'DATATBLS', 'OVERLAY', 'VECTOR', 'STORM', 'ACT'):
        return 'DRLG/Room/SUnit'
    if pfx == 'D2GAME':
        if any(k in upper for k in ('C2S_', 'PACKET_SRV')):
            return 'C2S'
        if any(k in upper for k in ('SKILL', 'SUMMON', 'PET', 'AURA', 'CURSE')):
            return 'Skills'
        if 'MISSILE' in upper:
            return 'Missiles'
        if any(k in upper for k in ('ITEM', 'CUBE', 'TRADE', 'SHOP', 'GAMBLE', 'NPC', 'STASH', 'DROP')):
            return 'Items/Cube/Trade'
        if any(k in upper for k in ('DMG', 'DAMAGE', 'MONSTER', 'MERC', 'UMOD', 'STAT')):
            return 'Combat/SUnitDmg'
        if 'QUEST' in upper:
            return 'Quests'
        if any(k in upper for k in ('ROOM', 'DRLG', 'SUNIT', 'OBJECT', 'EVENT', 'SHRINE', 'PORTAL')):
            return 'DRLG/Room/SUnit'
        return 'Party/Player/Client'
    return 'Party/Player/Client'


def strip_c_comments(text: str) -> str:
    return re.sub(r'//.*?$|/\*.*?\*/', ' ', text, flags=re.M | re.S)


def extract_c_emitter_vas(c_path: str, by_mod: dict[str, dict[int, dict]]) -> dict[str, set[int]]:
    raw = open(c_path, encoding='utf-8', errors='replace').read()
    code = strip_c_comments(raw)
    found: dict[str, set[int]] = {'D2Common': set(), 'D2Game': set()}
    for line in code.splitlines():
        # Never count hooked/stubbed target addresses as real-DLL-tested VAs.
        if 'install_jmp_hook' in line or 'pAutoMod' in line:
            continue
        for m in HEX_VA_RE.findall(line):
            v = int(m, 16)
            if v in by_mod['D2Common']:
                found['D2Common'].add(v)
            elif v in by_mod['D2Game']:
                found['D2Game'].add(v)
        for m in COM_ORD_RE.findall(line):
            va = D2COMMON_ORDINAL_TO_VA.get(int(m))
            if va is not None and va in by_mod['D2Common']:
                found['D2Common'].add(va)
    return found


def compute_audit() -> dict:
    manifest_path = os.path.join(REPO, 'tools', 'oracle', 'callgraph', 'manifest-113c.json')
    manifest = json.load(open(manifest_path, encoding='utf-8'))['functions']
    by_mod: dict[str, dict[int, dict]] = {'D2Common': {}, 'D2Game': {}}
    for fn in manifest:
        by_mod[fn['module']][int(fn['va'], 16)] = fn

    # 1. Scan .coverage.ndjson.gz across tests/fixtures/oracle/{k1,k3,k4,k6*}/**
    cov_base: dict[str, set[int]] = {'D2Common': set(), 'D2Game': set()}
    cov_k6: dict[str, set[int]] = {'D2Common': set(), 'D2Game': set()}
    per_scenario = []

    k6_fixture_dirs = sorted(
        os.path.basename(d)
        for d in glob.glob(os.path.join(REPO, 'tests', 'fixtures', 'oracle', 'k6*'))
        if os.path.isdir(d)
    )
    for sub in ('k1', 'k3', 'k4', *k6_fixture_dirs):
        pattern = os.path.join(REPO, 'tests', 'fixtures', 'oracle', sub, '**', '*.coverage.ndjson.gz')
        for cf in sorted(glob.glob(pattern, recursive=True)):
            rel = os.path.relpath(cf, REPO)
            s_c, s_g = set(), set()
            frames_to = 0
            for line in gzip.open(cf, 'rt', encoding='utf-8'):
                line = line.strip()
                if not line:
                    continue
                obj = json.loads(line)
                if obj.get('k') == 'hdr':
                    frames_to = int(obj.get('to', 0))
                    continue
                va = int(obj['va'], 16)
                mod = obj['m']
                if mod == 'D2Common' and va in by_mod['D2Common']:
                    s_c.add(va)
                elif mod == 'D2Game' and va in by_mod['D2Game']:
                    s_g.add(va)
            bucket = cov_k6 if sub.startswith('k6') else cov_base
            bucket['D2Common'] |= s_c
            bucket['D2Game'] |= s_g
            per_scenario.append({
                'suite': sub,
                'file': rel,
                'scenario': os.path.basename(cf).replace('.coverage.ndjson.gz', ''),
                'frames': frames_to,
                'd2CommonHits': len(s_c),
                'd2GameHits': len(s_g),
                'd2GameVas': sorted(s_g),
            })

    # Attach unique-vs-preK6-baseline counts for K6 scenarios
    for entry in per_scenario:
        if entry['suite'].startswith('k6'):
            new_vs_base = set(entry['d2GameVas']) - cov_base['D2Game']
            entry['d2GameNewVsBaseline'] = len(new_vs_base)
        else:
            entry['d2GameNewVsBaseline'] = 0
        del entry['d2GameVas']

    # 2. Scan real-DLL emitters in tools/oracle/vectors/*.c (+ requests/*.req.json) and tools/oracle/k6*/*.c
    emit_base: dict[str, set[int]] = {'D2Common': set(), 'D2Game': set()}
    emit_k6: dict[str, set[int]] = {'D2Common': set(), 'D2Game': set()}
    per_emitter = []

    for cf in sorted(glob.glob(os.path.join(REPO, 'tools', 'oracle', 'vectors', '*.c'))):
        found = extract_c_emitter_vas(cf, by_mod)
        emit_base['D2Common'] |= found['D2Common']
        emit_base['D2Game'] |= found['D2Game']
        if found['D2Common'] or found['D2Game']:
            per_emitter.append({
                'suite': 'vectors',
                'file': os.path.relpath(cf, REPO),
                'd2CommonVas': len(found['D2Common']),
                'd2GameVas': len(found['D2Game']),
            })

    for rf in sorted(glob.glob(os.path.join(REPO, 'tools', 'oracle', 'vectors', 'requests', '*.req.json'))):
        req = json.load(open(rf, encoding='utf-8'))
        mod = req.get('module')
        va = int(req['va'], 16)
        if mod in emit_base and va in by_mod[mod]:
            emit_base[mod].add(va)

    for cf in sorted(glob.glob(os.path.join(REPO, 'tools', 'oracle', 'k6*', '*.c'))):
        found = extract_c_emitter_vas(cf, by_mod)
        emit_k6['D2Common'] |= found['D2Common']
        emit_k6['D2Game'] |= found['D2Game']
        per_emitter.append({
            'suite': 'k6',
            'file': os.path.relpath(cf, REPO),
            'd2CommonVas': len(found['D2Common']),
            'd2GameVas': len(found['D2Game']),
        })

    scn_all_c = cov_base['D2Common'] | cov_k6['D2Common']
    emit_all_c = emit_base['D2Common'] | emit_k6['D2Common']
    comb_all_c = scn_all_c | emit_all_c

    scn_all_g = cov_base['D2Game'] | cov_k6['D2Game']
    emit_all_g = emit_base['D2Game'] | emit_k6['D2Game']
    comb_base_g = cov_base['D2Game'] | emit_base['D2Game']
    comb_all_g = scn_all_g | emit_all_g
    rem_g = set(by_mod['D2Game']) - comb_all_g

    sub_totals = defaultdict(int)
    sub_hit = defaultdict(int)
    sub_unhit = defaultdict(list)
    for va, fn in sorted(by_mod['D2Game'].items()):
        sub = classify_d2game_subsystem(fn)
        sub_totals[sub] += 1
        if va in comb_all_g:
            sub_hit[sub] += 1
        else:
            sub_unhit[sub].append(f'0x{va:08X}')

    subsystems = []
    for sub in SUBSYSTEM_ORDER:
        tot = sub_totals[sub]
        hit = sub_hit[sub]
        unhit_list = sub_unhit[sub]
        subsystems.append({
            'subsystem': sub,
            'total': tot,
            'verified': hit,
            'unhit': len(unhit_list),
            'sampleUnhitVas': unhit_list[:5],
        })

    return {
        'd2Common': {
            'total': len(by_mod['D2Common']),
            'baselineScenarioExecuted': len(cov_base['D2Common']),
            'scenarioExecuted': len(scn_all_c),
            'newScenarioVas': len(scn_all_c - cov_base['D2Common']),
            'emitterVerified': len(emit_all_c),
            'combinedVerified': len(comb_all_c),
            'remainingUnhit': len(by_mod['D2Common']) - len(comb_all_c),
            'remainingVas': [f'0x{v:08X}' for v in sorted(set(by_mod['D2Common']) - comb_all_c)],
        },
        'd2Game': {
            'total': len(by_mod['D2Game']),
            'baselineScenarioExecuted': len(cov_base['D2Game']),
            'scenarioExecuted': len(scn_all_g),
            'newScenarioVas': len(scn_all_g - cov_base['D2Game']),
            'baselineEmitterVerified': len(emit_base['D2Game']),
            'emitterVerified': len(emit_all_g),
            'newEmitterVas': len(emit_all_g - emit_base['D2Game']),
            'baselineCombinedVerified': len(comb_base_g),
            'combinedVerified': len(comb_all_g),
            'netNewCombinedVas': len(comb_all_g - comb_base_g),
            'remainingUnhit': len(rem_g),
            'subsystems': subsystems,
        },
        'scenarios': per_scenario,
        'k6Emitters': [e for e in per_emitter if e['suite'] == 'k6'],
    }


def print_report(res: dict) -> None:
    c = res['d2Common']
    g = res['d2Game']
    print('=== [K6] Real 1.13c DLL Coverage Audit ===')
    print()
    print(f"D2Common ({c['total']:,} manifest functions):")
    print(f"  Scenario DLL-executed VAs : {c['scenarioExecuted']:4d} / {c['total']:,} (baseline: {c['baselineScenarioExecuted']} / {c['total']:,}, +{c['newScenarioVas']} new)")
    print(f"  Real-DLL emitter VAs      : {c['emitterVerified']:4d} / {c['total']:,}")
    print(f"  Combined real-DLL VAs     : {c['combinedVerified']:4d} / {c['total']:,} ({c['combinedVerified'] * 100.0 / c['total']:.2f}%)")
    print(f"  Remaining un-hit VAs      : {c['remainingUnhit']:4d} / {c['total']:,} {c['remainingVas']}")
    print()
    print(f"D2Game ({g['total']:,} manifest functions):")
    print(f"  Scenario DLL-executed VAs : {g['scenarioExecuted']:4d} / {g['total']:,} (baseline: {g['baselineScenarioExecuted']} / {g['total']:,}, +{g['newScenarioVas']} new)")
    print(f"  Real-DLL emitter VAs      : {g['emitterVerified']:4d} / {g['total']:,} (baseline: {g['baselineEmitterVerified']} / {g['total']:,}, +{g['newEmitterVas']} new)")
    print(f"  Combined real-DLL VAs     : {g['combinedVerified']:4d} / {g['total']:,} (baseline: {g['baselineCombinedVerified']} / {g['total']:,}, +{g['netNewCombinedVas']} net new, {g['combinedVerified'] * 100.0 / g['total']:.2f}%)")
    print(f"  Remaining un-hit VAs      : {g['remainingUnhit']:4d} / {g['total']:,}")
    print()
    print('Remaining Un-hit D2Game VAs by Subsystem:')
    print(f"  {'Subsystem':22s} {'Verified':>8s} {'Unhit':>8s} {'Total':>8s} {'Pct':>7s}")
    print('  ' + '-' * 57)
    for s in g['subsystems']:
        pct = (s['verified'] * 100.0 / s['total']) if s['total'] else 0.0
        print(f"  {s['subsystem']:22s} {s['verified']:8d} {s['unhit']:8d} {s['total']:8d} {pct:6.1f}%")
    print()
    k6_scns = [s for s in res['scenarios'] if s['suite'] == 'k6']
    if k6_scns:
        print('K6 Golden Scenarios Recorded:')
        for s in k6_scns:
            print(
                f"  {s['scenario']:32s} frames={s['frames']:3d} "
                f"D2Common={s['d2CommonHits']:3d} D2Game={s['d2GameHits']:3d} "
                f"(+{s['d2GameNewVsBaseline']} vs pre-K6 baseline)"
            )


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--json', action='store_true', help='Emit machine-readable JSON')
    args = ap.parse_args()
    res = compute_audit()
    if args.json:
        print(json.dumps(res, indent=2))
    else:
        print_report(res)


if __name__ == '__main__':
    main()

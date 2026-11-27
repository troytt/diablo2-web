#!/usr/bin/env python3
"""Sole writer of the derived call-graph gate files (K1 conflict-free batch pipeline).

Derived files (never hand-edit them):
  * tools/oracle/callgraph/manifest-113c.json            (full regeneration via extract-callgraph.py)
  * docs/oracle/function-map.md, exactly two regions:
      (a) the "Manifest Status Accounting" summary span
          **`<dv>` `diff-verified` (`<p>%`) + `<ported>` `ported` (`<p>%`) = ... `readyInternalComposite`)
      (b) the single Phase-0 table row whose 4th cell starts with **ported** (
          (regenerated 1:1 from the manifest's ported functions, sorted by (module, va))

Modes:
  sync-gates.py                      regenerate and write both files
  sync-gates.py --check              regenerate in memory; exit 1 if either file would change
  sync-gates.py --ratchet <git-ref> [--allow FILE]
                                     exit 1 if, relative to <git-ref>, any function's status went down
                                     (diff-verified -> ported/unported, ported -> unported, which is also
                                     every binding removal), any function left the closure, or any
                                     bindings/*.json file present at <git-ref> was deleted. The only bypass
                                     is an explicit allowlist JSON file (see load_allowlist) in which every
                                     entry names one violation and carries a written justification; unused
                                     allowlist entries are themselves an error.

Inputs are the reviewed bindings (KERN_BINDINGS_113C + tools/oracle/callgraph/bindings/*.json), so the
derived files are a pure function of the repository state. See tools/oracle/callgraph/bindings/README.md.
"""
import argparse
import importlib.util
import json
import os
import re
import subprocess
import sys
import tempfile

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(SCRIPT_DIR)))
FN_MAP_PATH = os.path.join(REPO_ROOT, "docs", "oracle", "function-map.md")
MANIFEST_REL = "tools/oracle/callgraph/manifest-113c.json"
BINDINGS_REL = "tools/oracle/callgraph/bindings"
DUP_TSSYMBOL_ALLOWLIST_REL = "tools/oracle/callgraph/duplicate-tssymbol-allowlist.json"
_EXPORT_DEF_RE = re.compile(r"^export\s+(?:async\s+)?(?:function|const)\s+([A-Za-z0-9_$]+)\b", re.MULTILINE)

STATUS_RANK = {"unported": 0, "ported": 1, "diff-verified": 2}
MIN_JUSTIFICATION = 40


def load_extractor():
    """Imports extract-callgraph.py in-process (it re-execs into the d2oracle venv if capstone is missing)."""
    path = os.path.join(SCRIPT_DIR, "extract-callgraph.py")
    spec = importlib.util.spec_from_file_location("extract_callgraph_113c", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# ---------------------------------------------------------------- function-map.md rendering

_NUM = r"`[0-9][0-9,]*`"
_PCT = r"\(`[0-9]+\.[0-9]{2}%`\)"
_BRK = r"[ \t]*\n>[ \t]*|[ \t]+"  # the span is wrapped inside a '> ' blockquote paragraph
SUMMARY_RE = re.compile(
    rf"\*\*{_NUM} `diff-verified` {_PCT} \+ {_NUM} `ported` {_PCT} =(?:{_BRK})"
    rf"{_NUM} implemented closure functions\*\*(?:{_BRK})\({_NUM} `unported`,(?:{_BRK})"
    rf"\*\*{_NUM} unblocked `ready`\*\*(?:{_BRK})=(?:{_BRK}){_NUM}(?:{_BRK})"
    rf"`readyPureLeaf`(?:{_BRK})\+(?:{_BRK}){_NUM}(?:{_BRK})`readyHostImport`(?:{_BRK})\+(?:{_BRK})"
    rf"{_NUM}(?:{_BRK})`readyInternalComposite`\)"
)
PORTED_ROW_RE = re.compile(r"^\|[^\n]*\| \*\*ported\*\* \([^\n]*\|$", re.MULTILINE)


def _fmt(n: int) -> str:
    return f"`{n:,}`"


def _pct(n: int, total: int) -> str:
    return f"(`{100 * n / total:.2f}%`)"


def render_summary(manifest: dict) -> str:
    s = manifest["summary"]
    total = s["totalReachable"]
    sb = s["statusBreakdown"]
    rs = s["readySummary"]
    dv, ported, unported = sb["diff-verified"], sb["ported"], sb["unported"]
    return (
        f"**{_fmt(dv)} `diff-verified` {_pct(dv, total)} + {_fmt(ported)} `ported` {_pct(ported, total)} =\n"
        f"> {_fmt(dv + ported)} implemented closure functions** ({_fmt(unported)} `unported`, "
        f"**{_fmt(rs['ready'])} unblocked `ready`** = {_fmt(rs['readyPureLeaf'])}\n"
        f"> `readyPureLeaf` + {_fmt(rs['readyHostImport'])} `readyHostImport` + "
        f"{_fmt(rs['readyInternalComposite'])} `readyInternalComposite`)"
    )


def _cell(text: str) -> str:
    return text.replace("|", "\\|")


def render_ported_row(manifest: dict) -> str:
    ported = sorted(
        (f for f in manifest["functions"] if f["status"] == "ported"),
        key=lambda f: (f["module"], int(f["va"], 16)),
    )
    if not ported:
        return (
            "| — | — | `src/d2kern-113c/` (0 remaining) | "
            "**ported** (`0` closure functions remaining in `src/d2kern-113c/`; `100.00%` function-level `diff-verified` in `manifest-113c.json`) |"
        )
    vas = []
    cur_mod = None
    for f in ported:
        tok = f"`{f['va']}`"
        if f["module"] != cur_mod:
            tok = f"{f['module']} {tok}"
            cur_mod = f["module"]
        vas.append(tok)
    names = [f"`{f['name']}`" for f in ported]
    by_file = {}
    for f in ported:
        by_file.setdefault(f["kernFile"], []).append(f"`{f['tsSymbol']}`")
    ts_groups = [f"{', '.join(syms)} `{kf}`" for kf, syms in by_file.items()]
    status = (
        f"**ported** ({_fmt(len(ported))} closure functions implemented in `src/d2kern-113c/`, not yet "
        f"function-level diff-verified against the real DLL; per-function evidence in `manifest-113c.json`)"
    )
    cells = [", ".join(vas), ", ".join(names), ", ".join(ts_groups), status]
    return "| " + " | ".join(_cell(c) if i < 3 else c for i, c in enumerate(cells)) + " |"


def rewrite_function_map(text: str, manifest: dict) -> str:
    sums = list(SUMMARY_RE.finditer(text))
    if len(sums) != 1:
        raise ValueError(f"function-map.md: expected exactly 1 status summary span, found {len(sums)}")
    rows = list(PORTED_ROW_RE.finditer(text))
    if len(rows) != 1:
        raise ValueError(f"function-map.md: expected exactly 1 '| **ported** (' table row, found {len(rows)}")
    row = render_ported_row(manifest)
    if "src/d2kern-113c/" not in row.split(" | ")[2]:
        raise ValueError("ported row TS cell must reference src/d2kern-113c/ (legacy-ref parser skip rule)")
    spans = sorted(
        [(sums[0].start(), sums[0].end(), render_summary(manifest)), (rows[0].start(), rows[0].end(), row)],
        key=lambda t: t[0],
    )
    out = []
    pos = 0
    for start, end, repl in spans:
        out.append(text[pos:start])
        out.append(repl)
        pos = end
    out.append(text[pos:])
    return "".join(out)


def _legacy_refs_of_text(ex, text: str) -> dict:
    with tempfile.NamedTemporaryFile("w", suffix=".md", delete=False, encoding="utf-8") as tf:
        tf.write(text)
        tmp = tf.name
    try:
        return ex.parse_legacy_refs_from_function_map(tmp)
    finally:
        os.unlink(tmp)


def regenerate(ex):
    """Returns (manifest, manifest_text, fnmap_old, fnmap_new) computed purely in memory."""
    manifest = ex.build_manifest()
    manifest_text = ex.serialize_manifest(manifest)
    with open(FN_MAP_PATH, "r", encoding="utf-8") as f:
        fnmap_old = f.read()
    fnmap_new = rewrite_function_map(fnmap_old, manifest)
    # The rewritten regions must be invisible to the manifest's legacy-ref input parser, otherwise the
    # derived files would not be a fixed point.
    if _legacy_refs_of_text(ex, fnmap_old) != _legacy_refs_of_text(ex, fnmap_new):
        raise ValueError("function-map.md rewrite changed legacy-ref parser input (not a fixed point)")
    return manifest, manifest_text, fnmap_old, fnmap_new


# ---------------------------------------------------------------- private stand-in & callee gate

PENDING_LANE_BC_VAS = {
    "0X6FDCBB20",
    "0X6FD95990",
    "0X6FDD34D0",
    "0X6FDD37F0",
    "0X6FDD3990",
    "0X6FDD3B30",
    "0X6FD90C20",
    "0X6FD90DB0",
    "0X6FD92A70",
    "0X6FD965B0",
    "0X6FD97020",
    "0X6FD975E0",
    "0X6FDCBE90",
    "0X6FDCBE50",
    "0X6FDCBE10",
    "0X6FDCBDB0",
    "0X6FDCBC20",
}

# Caller-supplied callback & link-list dispatch functions whose indirect calls are
# caller-passed pfnCallback / host-registered server callbacks that cannot be statically
# enumerated in PE32:
#   - D2Common (11 VAs): pfAutomap/pfTownAutomap, pfnCallback, pSearch->pfnCallback,
#     pList->pfLinker/pfnValidate/pfnPost, pfOnValue, pfnActCall
#     (see d2common-final3-diff-verified.test.ts & laneD-ported29.test.ts).
#   - D2Game (31 VAs): caller-supplied visitor/filter/placement/party/client callbacks &
#     host-injected Storm/server callbacks audited in tools/oracle/callgraph/indirect-audit-batch{A,B,C,D}.json
#     and verified in tests/oracle/k2/k2-disasm-verified-wave{19-indA,20-indB,21-indC,22-indD}.test.ts.
VERIFIED_CALLER_CALLBACK_VAS = {
    # D2Common (11)
    "0X6FD5CD10",
    "0X6FD62330",
    "0X6FD624E0",
    "0X6FD62720",
    "0X6FD66E10",
    "0X6FD7A210",
    "0X6FD88850",
    "0X6FD888E0",
    "0X6FD88940",
    "0X6FD8C720",
    "0X6FDCF6A0",
    # D2Game Batch A (20: indirect-audit-batchA.json / k2-disasm-verified-wave19-indA.test.ts)
    "0X6FC22090",
    "0X6FC41490",
    "0X6FC517F0",
    "0X6FC51B40",
    "0X6FC68410",
    "0X6FCB6AF0",
    "0X6FCBC160",
    "0X6FCC06F0",
    "0X6FCC0AD0",
    "0X6FCC0C70",
    "0X6FCC4610",
    "0X6FCD06F0",
    "0X6FCD0720",
    "0X6FCD0CE0",
    "0X6FCD11A0",
    "0X6FCD7090",
    "0X6FCFE380",
    "0X6FCFFC10",
    "0X6FCFFCC0",
    "0X6FD0B090",
    # D2Game Batch B (2: indirect-audit-batchB.json / k2-disasm-verified-wave20-indB.test.ts)
    "0X6FCBEDB0",
    "0X6FCBEEB0",
    # D2Game Batch C (1: indirect-audit-batchC.json / k2-disasm-verified-wave21-indC.test.ts)
    "0X6FC6B7F0",
    # D2Game Batch D (8: indirect-audit-batchD.json / k2-disasm-verified-wave22-indD.test.ts)
    "0X6FC49820",
    "0X6FC4C2D0",
    "0X6FC4C570",
    "0X6FC4C830",
    "0X6FC4C910",
    "0X6FC4D9B0",
    "0X6FC74000",
    "0X6FCBC070",
}

_PRIVATE_FN_DEF_RE = re.compile(
    r"^\s*(?!export\b)(?:function\s+([A-Za-z0-9_$]+)|const\s+([A-Za-z0-9_$]+)\s*=\s*\()"
)
_VA_HEX_RE = re.compile(r"0x6F[CD][0-9A-Fa-f]{5}", re.IGNORECASE)


def _strip_ts_comments(src: str) -> str:
    src = re.sub(r"/\*[\s\S]*?\*/", "", src)
    src = re.sub(r"//[^\n]*", "", src)
    return src


def check_private_standins_and_callees(
    manifest: dict,
    batch_bindings: list,
    source_files: dict,
    strict_standins: bool = False,
) -> tuple:
    """Enforces that diff-verified K1 bindings have no unported callees, no indirectUnknown classification,
    and no private stand-in functions or vtable stand-ins for unported closure VAs in their kernFile."""
    errors = []
    warnings = []

    binding_vas_upper = {b["va"].upper() for b in batch_bindings}
    pre_merge_lane_bc = (not strict_standins) and (
        "0X6FD95990" in binding_vas_upper or "0X6FDCBB20" in binding_vas_upper
    )

    fn_by_key = {f"{f['module'].upper()}:{f['va'][2:].upper()}": f for f in manifest.get("functions", [])}
    fn_by_va = {f["va"].upper(): f for f in manifest.get("functions", [])}

    pending_bc_vas = set(PENDING_LANE_BC_VAS)
    for pva in list(PENDING_LANE_BC_VAS):
        pf = fn_by_va.get(pva, {})
        for c in pf.get("callees", []):
            if ":" in c:
                pending_bc_vas.add("0X" + c.split(":", 1)[1].upper())

    dv_kern_files = set()
    for b in batch_bindings:
        if b.get("status") != "diff-verified":
            continue
        dv_kern_files.add(b["kernFile"])
        va_up = b["va"].upper()
        key = f"{b['module'].upper()}:{va_up[2:]}"
        fn = fn_by_key.get(key, {})
        if fn.get("indirectUnknown") and va_up not in VERIFIED_CALLER_CALLBACK_VAS:
            msg = f"{b['module']}:{b['va']} ({b['name']}) is diff-verified but has unresolved indirect calls (indirectUnknown)"
            if pre_merge_lane_bc and va_up in pending_bc_vas:
                warnings.append(msg)
            else:
                errors.append(msg)
        unported_callees = [
            c for c in fn.get("callees", []) if fn_by_key.get(c.upper(), {}).get("status") == "unported"
        ]
        if unported_callees:
            msg = (
                f"{b['module']}:{b['va']} ({b['name']}) is diff-verified but has unported callees: "
                + ", ".join(unported_callees)
            )
            if pre_merge_lane_bc and va_up in pending_bc_vas:
                warnings.append(msg)
            else:
                errors.append(msg)

    for kern_file in sorted(dv_kern_files):
        src = source_files.get(kern_file, "")
        if not src:
            continue
        lines = src.splitlines()
        for idx, line in enumerate(lines):
            m = _PRIVATE_FN_DEF_RE.match(line)
            if not m:
                continue
            fn_sym = m.group(1) or m.group(2)
            # Collect contiguous preceding comment block
            k = idx - 1
            while k >= 0 and lines[k].strip() == "":
                k -= 1
            c_end = k
            while k >= 0 and (
                lines[k].strip().startswith("*")
                or lines[k].strip().startswith("/*")
                or lines[k].strip().startswith("//")
                or lines[k].strip().endswith("*/")
            ):
                k -= 1
            comment_block = "\n".join(lines[k + 1 : c_end + 1]) + "\n" + fn_sym
            for vm in _VA_HEX_RE.finditer(comment_block):
                va_up = "0X" + vm.group(0)[2:].upper()
                fentry = fn_by_va.get(va_up)
                if fentry and fentry.get("status") == "unported":
                    msg = f"{kern_file}:{idx + 1} private stand-in function '{fn_sym}' implements unported closure VA 0x{va_up[2:]}"
                    if pre_merge_lane_bc and va_up in pending_bc_vas:
                        warnings.append(msg)
                    else:
                        errors.append(msg)

        code_only = _strip_ts_comments(src)
        seen_code_vas = set()
        for vm in _VA_HEX_RE.finditer(code_only):
            va_up = "0X" + vm.group(0)[2:].upper()
            if va_up in seen_code_vas:
                continue
            seen_code_vas.add(va_up)
            fentry = fn_by_va.get(va_up)
            if fentry and fentry.get("status") == "unported":
                msg = f"{kern_file} code references unported closure VA 0x{va_up[2:]} as inline/vtable stand-in"
                if pre_merge_lane_bc and va_up in pending_bc_vas:
                    warnings.append(msg)
                else:
                    errors.append(msg)

    return errors, warnings


def check_duplicate_manifest_tssymbols(repo_root: str, manifest: dict) -> list:
    """Enforces single-definition rule for manifest-bound tsSymbols in src/d2kern-113c/** against monotonic allowlist."""
    allow_path = os.path.join(repo_root, DUP_TSSYMBOL_ALLOWLIST_REL)
    if not os.path.isfile(allow_path):
        return [f"missing {DUP_TSSYMBOL_ALLOWLIST_REL}"]
    with open(allow_path, "r", encoding="utf-8") as f:
        cfg = json.load(f)
    max_count = cfg.get("maxCount", -1)
    symbols = cfg.get("symbols", [])
    errors = []
    if not isinstance(max_count, int) or max_count < 0 or max_count > 98:
        errors.append(f"{DUP_TSSYMBOL_ALLOWLIST_REL}: maxCount ({max_count}) must be in [0, 98]")
    if not isinstance(symbols, list) or symbols != sorted(set(symbols)):
        errors.append(f"{DUP_TSSYMBOL_ALLOWLIST_REL}: symbols must be a sorted unique list")
    if isinstance(symbols, list) and isinstance(max_count, int) and len(symbols) > max_count:
        errors.append(f"{DUP_TSSYMBOL_ALLOWLIST_REL}: len(symbols)={len(symbols)} exceeds maxCount={max_count}")

    bound = {fn["tsSymbol"] for fn in manifest.get("functions", []) if fn.get("tsSymbol")}
    defs = {}
    kern_dir = os.path.join(repo_root, "src", "d2kern-113c")
    for r, _, files in os.walk(kern_dir):
        for fn_name in sorted(files):
            if not fn_name.endswith(".ts"):
                continue
            abs_p = os.path.join(r, fn_name)
            rel_p = os.path.relpath(abs_p, repo_root).replace("\\", "/")
            with open(abs_p, "r", encoding="utf-8") as sf:
                txt = sf.read()
            for m in _EXPORT_DEF_RE.finditer(txt):
                sym = m.group(1)
                if sym in bound:
                    defs.setdefault(sym, []).append(rel_p)

    actual_dups = {sym: paths for sym, paths in defs.items() if len(paths) > 1}
    allow_set = set(symbols) if isinstance(symbols, list) else set()
    for sym in sorted(set(actual_dups) - allow_set):
        errors.append(f"unallowlisted duplicate manifest tsSymbol '{sym}' in {', '.join(actual_dups[sym])}")
    for sym in sorted(allow_set - set(actual_dups)):
        errors.append(f"stale allowlisted tsSymbol '{sym}' in {DUP_TSSYMBOL_ALLOWLIST_REL} (now defined <= 1 time; remove and lower maxCount)")
    return errors


def load_k1_bindings_and_sources(repo_root: str) -> tuple:
    bdir = os.path.join(repo_root, BINDINGS_REL)
    batch_bindings = []
    source_files = {}
    if os.path.isdir(bdir):
        for fname in sorted(os.listdir(bdir)):
            if not fname.endswith(".json"):
                continue
            with open(os.path.join(bdir, fname), "r", encoding="utf-8") as f:
                arr = json.load(f)
            if isinstance(arr, list):
                for e in arr:
                    batch_bindings.append(e)
                    kf = e.get("kernFile")
                    if kf and kf not in source_files:
                        abs_kf = os.path.join(repo_root, kf)
                        if os.path.isfile(abs_kf):
                            with open(abs_kf, "r", encoding="utf-8") as sf:
                                source_files[kf] = sf.read()
    return batch_bindings, source_files


# ---------------------------------------------------------------- ratchet

MIN_INLINE_REASON = 20


def _git(*args: str) -> str:
    return subprocess.run(
        ["git", "-C", REPO_ROOT, *args], check=True, capture_output=True, text=True
    ).stdout


def load_allowlist(path):
    """Allowlist JSON: [{"item": "<D2Common:0x6FD87F80 | bindings/<file>.json>", "justification": "..."}].

    Every entry must name exactly one ratchet violation and carry a justification of at least
    MIN_JUSTIFICATION characters (paste the same text into the merge commit message)."""
    if path is None:
        return {}
    with open(path, "r", encoding="utf-8") as f:
        arr = json.load(f)
    if not isinstance(arr, list):
        raise ValueError(f"{path}: allowlist must be a JSON array")
    out = {}
    for i, e in enumerate(arr):
        if not isinstance(e, dict) or set(e) != {"item", "justification"}:
            raise ValueError(f"{path}[{i}]: entries need exactly the keys 'item' and 'justification'")
        if not isinstance(e["justification"], str) or len(e["justification"].strip()) < MIN_JUSTIFICATION:
            raise ValueError(f"{path}[{i}]: justification must be >= {MIN_JUSTIFICATION} characters")
        if e["item"] in out:
            raise ValueError(f"{path}[{i}]: duplicate item {e['item']}")
        out[e["item"]] = e["justification"].strip()
    return out


def parse_allow_specs(allow_specs, allow_file=None, viol_keys=()) -> dict:
    """Combines optional --allow-file JSON and repeated --allow (<VA>:<reason> or JSON file path) specs."""
    out = {}
    if allow_file:
        out.update(load_allowlist(allow_file))
    for spec in allow_specs or []:
        if ":" not in spec and os.path.isfile(spec):
            for k, v in load_allowlist(spec).items():
                if k in out:
                    raise ValueError(f"duplicate allowlist item {k}")
                out[k] = v
            continue
        # Parse <Module>:<VA>:<reason>, <VA>:<reason>, or bindings/<file>.json:<reason>
        parts = spec.split(":", 2)
        if len(parts) == 3 and parts[0] in ("D2Common", "D2Game") and parts[1].lower().startswith("0x"):
            item = f"{parts[0]}:0x{parts[1][2:].upper()}"
            reason = parts[2].strip()
        elif len(parts) >= 2:
            raw_item, reason = spec.split(":", 1)
            raw_item = raw_item.strip()
            reason = reason.strip()
            if raw_item.lower().startswith("0x"):
                va_norm = f"0x{raw_item[2:].upper()}"
                matched = [vk for vk in viol_keys if vk.endswith(f":{va_norm}")]
                if len(matched) == 1:
                    item = matched[0]
                elif va_norm.startswith("0x6FD"):
                    item = f"D2Common:{va_norm}"
                else:
                    item = f"D2Game:{va_norm}"
            else:
                item = raw_item
        else:
            raise ValueError(f"invalid --allow spec '{spec}': expected <VA>:<reason> or JSON file path")
        if len(reason) < MIN_INLINE_REASON:
            raise ValueError(f"--allow {item}: reason must be >= {MIN_INLINE_REASON} characters")
        if item in out:
            raise ValueError(f"duplicate allowlist item {item}")
        out[item] = reason
    return out


def ratchet_violations(old_manifest: dict, new_manifest: dict, old_binding_files, new_binding_files) -> dict:
    """Returns {item: description} of every monotonicity violation from old -> new."""
    viol = {}
    old_fns = {f"{f['module']}:{f['va']}": f for f in old_manifest["functions"]}
    new_fns = {f"{f['module']}:{f['va']}": f for f in new_manifest["functions"]}
    for key in sorted(old_fns):
        a = old_fns[key]
        b = new_fns.get(key)
        if b is None:
            viol[key] = f"{key} ({a['name']}) left the closure (was {a['status']})"
            continue
        if STATUS_RANK[b["status"]] < STATUS_RANK[a["status"]]:
            viol[key] = f"{key} ({a['name']}) status downgrade {a['status']} -> {b['status']}"
    for fname in sorted(set(old_binding_files) - set(new_binding_files)):
        item = f"bindings/{fname}"
        viol[item] = f"{item} was deleted"
    return viol


def dup_allowlist_ratchet_violations(ref: str, repo_root: str) -> list:
    """Forbids increasing maxCount or adding new symbols to duplicate-tssymbol-allowlist.json vs <ref> (if present at <ref>)."""
    try:
        old_raw = _git("show", f"{ref}:{DUP_TSSYMBOL_ALLOWLIST_REL}")
    except subprocess.CalledProcessError:
        return []
    old_cfg = json.loads(old_raw)
    cur_path = os.path.join(repo_root, DUP_TSSYMBOL_ALLOWLIST_REL)
    if not os.path.isfile(cur_path):
        return [f"{DUP_TSSYMBOL_ALLOWLIST_REL} was deleted"]
    with open(cur_path, "r", encoding="utf-8") as f:
        new_cfg = json.load(f)
    errs = []
    if new_cfg.get("maxCount", 999) > old_cfg.get("maxCount", 98):
        errs.append(
            f"{DUP_TSSYMBOL_ALLOWLIST_REL} maxCount increased {old_cfg.get('maxCount')} -> {new_cfg.get('maxCount')}"
        )
    added = sorted(set(new_cfg.get("symbols", [])) - set(old_cfg.get("symbols", [])))
    for sym in added:
        errs.append(f"{DUP_TSSYMBOL_ALLOWLIST_REL} added duplicate tsSymbol '{sym}' (only removals allowed)")
    return errs


def run_ratchet(ref: str, allow_specs, allow_file=None) -> int:
    old_manifest = json.loads(_git("show", f"{ref}:{MANIFEST_REL}"))
    with open(os.path.join(REPO_ROOT, MANIFEST_REL), "r", encoding="utf-8") as f:
        new_manifest = json.load(f)
    old_files = [
        os.path.basename(p) for p in _git("ls-tree", "--name-only", f"{ref}", f"{BINDINGS_REL}/").split("\n") if p
    ]
    bdir = os.path.join(REPO_ROOT, BINDINGS_REL)
    new_files = os.listdir(bdir) if os.path.isdir(bdir) else []
    viol = ratchet_violations(old_manifest, new_manifest, old_files, new_files)
    allow = parse_allow_specs(allow_specs, allow_file=allow_file, viol_keys=tuple(viol.keys()))
    failed = False
    for item, desc in viol.items():
        if item in allow:
            print(f"[ratchet] ALLOWED: {desc} -- justification: {allow[item]}")
        else:
            print(f"[ratchet] VIOLATION: {desc}")
            failed = True
    for item in sorted(set(allow) - set(viol)):
        print(f"[ratchet] UNUSED allowlist entry (not a violation vs {ref}): {item}")
        failed = True
    for derr in dup_allowlist_ratchet_violations(ref, REPO_ROOT):
        print(f"[ratchet] VIOLATION: {derr}")
        failed = True
    if failed:
        print(f"[ratchet] FAILED against {ref}")
        return 1
    print(f"[ratchet] OK against {ref}: {len(viol)} allowed violation(s), no status downgrades or binding deletions")
    return 0


# ---------------------------------------------------------------- self-test (negative controls)


class SelfTestError(Exception):
    pass


def _check(cond, msg="self-test check failed"):
    if not cond:
        raise SelfTestError(str(msg))


def self_test() -> int:
    """Pure checks of the ratchet, allowlist, stand-in gate, and renderer logic on synthetic inputs."""

    def fn(mod, va, status, name, callees=None, indirect_unknown=False):
        d = {
            "module": mod,
            "va": va,
            "status": status,
            "name": name,
            "kernFile": "src/d2kern-113c/x.ts",
            "tsSymbol": name + "113c",
            "callees": callees or [],
        }
        if indirect_unknown:
            d["indirectUnknown"] = True
        return d

    old = {"functions": [fn("D2Common", "0x6FD00010", "diff-verified", "A_A"),
                         fn("D2Common", "0x6FD00020", "ported", "B_B"),
                         fn("D2Common", "0x6FD00030", "unported", "C_C"),
                         fn("D2Game", "0x6FC00040", "ported", "D_D")]}
    same = json.loads(json.dumps(old))
    _check(ratchet_violations(old, same, ["a.json"], ["a.json", "b.json"]) == {}, "identity must pass")
    up = json.loads(json.dumps(old))
    up["functions"][2]["status"] = "ported"
    up["functions"][1]["status"] = "diff-verified"
    _check(ratchet_violations(old, up, [], []) == {}, "promotions must pass")
    down = json.loads(json.dumps(old))
    down["functions"][0]["status"] = "ported"
    down["functions"][1]["status"] = "unported"
    del down["functions"][3]
    v = ratchet_violations(old, down, ["a.json", "b.json"], ["a.json"])
    _check(set(v) == {"D2Common:0x6FD00010", "D2Common:0x6FD00020", "D2Game:0x6FC00040", "bindings/b.json"}, v)
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as tf:
        json.dump([{"item": "D2Common:0x6FD00020", "justification": "short"}], tf)
        bad = tf.name
    try:
        try:
            load_allowlist(bad)
            raise SelfTestError("short justification must be rejected")
        except ValueError:
            pass
    finally:
        os.unlink(bad)

    # Inline --allow <VA>:<reason> checks
    parsed_inline = parse_allow_specs(
        ["0x6FD00020:Audit P0-2 downgrade due to 25 unported jump table targets"],
        viol_keys=tuple(v.keys()),
    )
    _check(parsed_inline == {"D2Common:0x6FD00020": "Audit P0-2 downgrade due to 25 unported jump table targets"})
    try:
        parse_allow_specs(["0x6FD00020:too short"])
        raise SelfTestError("short inline --allow reason must be rejected")
    except ValueError:
        pass

    # Stand-in & unported-callee gate checks
    syn_manifest = {
        "functions": [
            fn("D2Common", "0x6FD50010", "diff-verified", "CallerFn", callees=["D2Common:6FD50020"]),
            fn("D2Common", "0x6FD50020", "unported", "UnportedCallee"),
            fn("D2Common", "0x6FD50030", "diff-verified", "IndirectFn", indirect_unknown=True),
        ]
    }
    syn_bindings = [
        {"module": "D2Common", "va": "0x6FD50010", "name": "CallerFn", "status": "diff-verified", "kernFile": "src/d2kern-113c/x.ts"},
        {"module": "D2Common", "va": "0x6FD50030", "name": "IndirectFn", "status": "diff-verified", "kernFile": "src/d2kern-113c/x.ts"},
    ]
    syn_sources = {
        "src/d2kern-113c/x.ts": (
            "/** Helper for 0x6FD50020 */\n"
            "function fakeHelper113c() { return 0; }\n"
            "export function CallerFn113c() { const p = 0x6fd50020; return p ? fakeHelper113c() : 0; }\n"
        )
    }
    errs, _ = check_private_standins_and_callees(syn_manifest, syn_bindings, syn_sources, strict_standins=True)
    _check(len(errs) == 4, f"expected 4 stand-in/callee errors, got {errs}")

    man = {"summary": {"totalReachable": 4810, "statusBreakdown": {"diff-verified": 90, "ported": 1, "unported": 4719},
                       "readySummary": {"ready": 1200, "readyPureLeaf": 700, "readyHostImport": 300,
                                        "readyInternalComposite": 200}},
           "functions": [fn("D2Common", "0x6FD00020", "ported", "B|B"), fn("D2Common", "0x6FD00010", "diff-verified", "A_A")]}
    row = render_ported_row(man)
    _check(row.startswith("| D2Common `0x6FD00020` | `B\\|B` | `B\\|B113c` `src/d2kern-113c/x.ts` | **ported** (`1` "), row)
    doc = ("> x: **`89` `diff-verified` (`1.85%`) + `40` `ported` (`0.83%`) =\n> `129` implemented closure functions** "
           "(`4,681` `unported`, **`1,190` unblocked `ready`** = `667`\n> `readyPureLeaf` + `355` `readyHostImport` + "
           "`168` `readyInternalComposite`). tail\n\n| a | b | c | **ported** (`40` closure functions old) |\n")
    new = rewrite_function_map(doc, man)
    _check("**`90` `diff-verified` (`1.87%`) + `1` `ported` (`0.02%`) =\n> `91` implemented" in new, new)
    _check("**`1,200` unblocked `ready`** = `700`" in new and new.endswith(row + "\n"), new)
    _check(rewrite_function_map(new, man) == new, "rewrite must be idempotent")
    man_zero = {
        "summary": {
            "totalReachable": 4810,
            "statusBreakdown": {"diff-verified": 4810, "ported": 0, "unported": 0},
            "readySummary": {"ready": 0, "readyPureLeaf": 0, "readyHostImport": 0, "readyInternalComposite": 0},
        },
        "functions": [fn("D2Common", "0x6FD00010", "diff-verified", "A_A")],
    }
    row_zero = render_ported_row(man_zero)
    _check("src/d2kern-113c/" in row_zero.split(" | ")[2], row_zero)
    _check("| **ported** (`0` closure functions" in row_zero, row_zero)
    new_zero = rewrite_function_map(new, man_zero)
    _check("**`4,810` `diff-verified` (`100.00%`) + `0` `ported` (`0.00%`)" in new_zero, new_zero)
    _check(rewrite_function_map(new_zero, man_zero) == new_zero, "0-ported rewrite must be idempotent")
    try:
        rewrite_function_map(doc + "| a | b | c | **ported** (`2` dup) |\n", man)
        raise AssertionError("two ported rows must be rejected")
    except ValueError:
        pass
    print("[sync-gates] SELF-TEST OK")
    return 0


# ---------------------------------------------------------------- CLI


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Sole writer of manifest-113c.json + function-map.md gate regions")
    ap.add_argument("--check", action="store_true", help="exit 1 if regeneration would change any derived file")
    ap.add_argument("--ratchet", metavar="GIT_REF", help="forbid status downgrades / binding deletions vs GIT_REF")
    ap.add_argument("--self-test", action="store_true", help="run the synthetic negative-control self-test")
    ap.add_argument(
        "--allow",
        action="append",
        default=[],
        metavar="SPEC",
        help="ratchet exception (<VA>:<reason> with reason >= 20 chars, or path to allowlist JSON)",
    )
    ap.add_argument("--allow-file", metavar="FILE", help="ratchet allowlist JSON file")
    ap.add_argument(
        "--strict-standins",
        action="store_true",
        help="fail on all private stand-ins / unported callees even before Lane B/C merge",
    )
    args = ap.parse_args(argv)
    if args.self_test and (args.check or args.ratchet):
        ap.error("--self-test cannot be combined with --check or --ratchet")
    if (args.allow or args.allow_file) and not args.ratchet:
        ap.error("--allow / --allow-file is only valid with --ratchet")

    if args.self_test:
        return self_test()
    if args.ratchet and not args.check:
        return run_ratchet(args.ratchet, args.allow, allow_file=args.allow_file)

    ex = load_extractor()
    manifest, manifest_text, fnmap_old, fnmap_new = regenerate(ex)
    batch_bindings, source_files = load_k1_bindings_and_sources(REPO_ROOT)
    standin_errors, standin_warnings = check_private_standins_and_callees(
        manifest, batch_bindings, source_files, strict_standins=args.strict_standins
    )
    for w in standin_warnings:
        print(f"[sync-gates] WARN (pending Lane B/C merge): {w}")
    if standin_errors:
        for err in standin_errors:
            print(f"[sync-gates] STANDIN/CALLEE VIOLATION: {err}")
        print("[sync-gates] FAILED: diff-verified functions cannot use private stand-ins or unported callees")
        return 1

    dup_errors = check_duplicate_manifest_tssymbols(REPO_ROOT, manifest)
    if dup_errors:
        for err in dup_errors:
            print(f"[sync-gates] DUPLICATE TSSYMBOL VIOLATION: {err}")
        print("[sync-gates] FAILED: manifest-bound tsSymbols violate single-definition allowlist")
        return 1

    manifest_path = ex.DEFAULT_MANIFEST_PATH
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest_old = f.read()

    if args.check:
        ok = True
        if manifest_old != manifest_text:
            print(f"[sync-gates] STALE {MANIFEST_REL}: {ex.first_manifest_difference(manifest_old, manifest_text)}")
            ok = False
        if fnmap_old != fnmap_new:
            print("[sync-gates] STALE docs/oracle/function-map.md (summary span or ported row)")
            ok = False
        if not ok:
            print("[sync-gates] CHECK FAILED: run tools/oracle/callgraph/sync-gates.py and commit the result")
            return 1
        print("[sync-gates] CHECK OK: manifest-113c.json and function-map.md are up to date")
        if args.ratchet:
            return run_ratchet(args.ratchet, args.allow, allow_file=args.allow_file)
        return 0

    with open(manifest_path, "w", encoding="utf-8") as f:
        f.write(manifest_text)
    with open(FN_MAP_PATH, "w", encoding="utf-8") as f:
        f.write(fnmap_new)
    print(
        f"[sync-gates] wrote {MANIFEST_REL} ({'changed' if manifest_old != manifest_text else 'unchanged'}) and "
        f"docs/oracle/function-map.md ({'changed' if fnmap_old != fnmap_new else 'unchanged'})"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())

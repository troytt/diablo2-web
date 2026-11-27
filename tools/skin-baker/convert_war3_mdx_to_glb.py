#!/usr/bin/env python3
"""
Warcraft III MDLX (.mdx) + BLP1 (.blp) -> glTF 2.0 binary (.glb) converter
(`tools/skin-baker/convert_war3_mdx_to_glb.py`).

Emits one source-neutral `.glb` per unit (mesh, skin, per-clip skeletal animations and
embedded PNG textures) for the real-time mesh skin renderer. Animations are keyed by
Diablo II mode tokens (`nu`, `wl`, `a1`, ...), so any other art source that can be
converted to the same GLB layout plugs into the same runtime.

Model-specific features that glTF core cannot express live in `extras`:
  - node.extras.billboard            camera-facing node
  - material.extras.filterMode       0 opaque, 1 cutout, 2 blend, 3 additive, 4 add-alpha
  - material.extras.unshaded         skip Lambert shading
  - material.extras.texAnim          index into animation.extras.texOffset targets
  - primitive.extras.geoset/layer    draw order and animation target ids
  - primitive.extras.alpha/color     static geoset alpha and colour
  - animation.extras.geosetAlpha / layerAlpha / geosetColor / texOffset
        [{ target..., input: accessor, output: accessor, interpolation }]
  - animation.extras.durationMs / loop / moveSpeed / source
"""

from __future__ import annotations

import argparse
import io
import json
import math
import os
import struct
import sys
from typing import Dict, List, Optional, Tuple

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bake_war3_mdx as mdx  # noqa: E402

SAMPLE_HZ = 30.0
CURVE_STEP_MS = 1000.0 / 60.0
HIT_CLIP_MS = 400.0
HIT_RECOIL_UNITS = 12.0

# Logical scene pixels per model unit, as tuned and visually verified against Diablo II units.
UNIT_PX_PER_UNIT = {
    "hero": 0.52,
    "necroskeleton": 0.704,
    "necromage": 0.528,
    "claygolem": 0.424,
    "bloodgolem": 0.456,
    "irongolem": 0.424,
    "firegolem": 0.408,
}
BOX_MARGIN_PX = 8
BOX_MAX_PX = 420
SIN_PITCH = 0.5
COS_PITCH = math.sqrt(1.0 - SIN_PITCH * SIN_PITCH)

# Warcraft III unit ids, used to read the authored damage / cast points (seconds into the
# animation at which the hit lands or the spell is released) from `units/unitweapons.slk`.
UNIT_IDS = {
    "hero": "Ulic",
    "necroskeleton": "ugho",
    "necromage": "unec",
    "claygolem": "ngst",
    "bloodgolem": "uabo",
    "irongolem": "nfgl",
    "firegolem": "ninf",
}
# Clip -> unitweapons.slk column holding its action point.
ACTION_POINT_COLUMN = {"a1": "dmgpt1", "a2": "dmgpt1", "sc": "castpt"}

# Skins this converter can build: Warcraft III team colour index plus the units of the pack.
# A unit spec may carry `px` (scene pixels per model unit), `unit_id` (unitweapons.slk row) and
# `phylactery` (the model dissolves on death and leaves Kel'Thuzad's phylactery behind); units
# without them fall back to the per-key tables above.
SKINS = {
    "ne-kelthuzad": {
        "team_color": 3,
        "units": [dict(spec, phylactery=spec["key"] == "hero") for spec in mdx.UNIT_SPECS],
    },
    "so-jaina": {
        "team_color": 1,
        "units": [
            {
                "key": "hero",
                "mdx": "units/human/jaina/jaina.mdx",
                "btn": "replaceabletextures/commandbuttons/btnjaina.blp",
                "px": 0.62,
                "unit_id": "Hjai",
                "extra_orb": None,
            },
        ],
    },
    "ai-maiev": {
        "team_color": 2,
        "units": [
            {
                "key": "hero",
                "mdx": "units/nightelf/maiev/maiev.mdx",
                "btn": "replaceabletextures/commandbuttons/btnwarden2.blp",
                "px": 0.53,
                "unit_id": "Ewrd",
                "extra_orb": None,
                "extra_clips": [("a2", ["Attack - 2"], False)],
            },
        ],
    },
    "ba-grom": {
        "team_color": 0,
        "units": [
            {
                "key": "hero",
                "mdx": "units/orc/hellscream/hellscream.mdx",
                "btn": "replaceabletextures/commandbuttons/btnhellscream.blp",
                "px": 0.64,
                "unit_id": "Ogrh",
                "extra_orb": None,
                # Grom has no spell animation: war cries use his victory roar.
                "clip_sources": {"sc": ["Stand Victory"]},
                "extra_clips": [("a2", ["Attack 2"], False)],
            },
        ],
    },
    "pa-arthas": {
        "team_color": 1,
        "units": [
            {
                "key": "hero",
                "mdx": "units/human/arthas/arthas.mdx",
                "btn": "replaceabletextures/commandbuttons/btnarthas.blp",
                "px": 0.6,
                "unit_id": "Hart",
                "extra_orb": None,
                "clip_sources": {"gh": ["Stand Hit"]},
                "extra_clips": [("a2", ["Attack - 2"], False)],
            },
        ],
    },
    "dz-malfurion": {
        "team_color": 6,
        "units": [
            {
                "key": "hero",
                "mdx": "units/nightelf/malfurion/malfurionnostag.mdx",
                "btn": "replaceabletextures/commandbuttons/btnfurion.blp",
                "px": 0.56,
                "unit_id": "Emns",
                "extra_orb": None,
                "extra_clips": [("a2", ["Attack -2"], False)],
            },
        ],
    },
    "am-sylvanas": {
        "team_color": 3,
        "units": [
            {
                "key": "hero",
                "mdx": "units/undead/evilsylvanas/evilsylvanas.mdx",
                "btn": "replaceabletextures/commandbuttons/btnbansheeranger.blp",
                "px": 0.7,
                "unit_id": "Usyl",
                "extra_orb": None,
                "extra_clips": [("a2", ["Attack - 2"], False)],
            },
        ],
    },
}

HERO_CLIPS = [
    ("nu", ["Stand", "Stand - 1"], True),
    ("wl", ["Walk"], True),
    ("sc", ["Spell", "Stand Channel"], False),
    ("a1", ["Attack", "Attack - 1"], False),
    ("gh", ["Stand Ready", "Stand"], False),
    ("dt", ["Death"], False),
]
MINION_CLIPS = [
    ("nu", ["Stand - 1", "Stand"], True),
    ("wl", ["Walk"], True),
    ("a1", ["Attack - 1", "Attack -1", "Attack", "Spell Attack"], False),
    ("s1", ["Birth", "Stand Ready", "Stand Channel", "Stand - 1", "Stand"], False),
    ("gh", ["Stand Hit", "Stand Ready", "Stand - 2", "Stand 2", "Stand"], False),
    ("dt", ["Death"], False),
]

def clip_defs_for(spec: dict) -> List[Tuple[str, List[str], bool]]:
    """Clips to export for a unit: (Diablo II mode token, candidate source sequences, loop)."""
    if spec["key"] != "hero":
        return MINION_CLIPS
    sources = spec.get("clip_sources") or {}
    defs = [(key, sources.get(key, names), loop) for key, names, loop in HERO_CLIPS]
    return defs + list(spec.get("extra_clips") or [])


def find_clip_sequence(m: "mdx.MdxModel", unit_key: str, c_key: str, seq_names: List[str]) -> "mdx.MdxSequence":
    """`mdx.find_sequence`, but a clip that matches none of its candidates is an error."""
    seq = mdx.find_sequence(m, seq_names)
    if not any(seq.name.lower().startswith(n.lower()) for n in seq_names):
        raise SystemExit(f"{unit_key}: no source sequence for clip {c_key!r} among {seq_names} "
                         f"(model has {[s.name for s in m.sequences]})")
    return seq


Channel = Tuple[List[float], List[List[float]], str]  # (times_ms relative, values, interpolation)


def read_slk_rows(path: str) -> Dict[str, Dict[str, str]]:
    """Reads a SYLK table into `{first-column id: {column name: value}}`."""
    cells: Dict[int, Dict[int, str]] = {}
    y = 0
    with open(path, encoding="latin1") as f:
        for line in f:
            line = line.rstrip("\r\n")
            if not line.startswith("C;"):
                continue
            x = None
            value = None
            for part in line.split(";")[1:]:
                if part.startswith("X"):
                    x = int(part[1:])
                elif part.startswith("Y"):
                    y = int(part[1:])
                elif part.startswith("K"):
                    value = part[1:].strip('"')
            if x is not None and value is not None:
                cells.setdefault(y, {})[x] = value
    header = cells.get(1, {})
    out: Dict[str, Dict[str, str]] = {}
    for row_y, row in cells.items():
        if row_y == 1 or 1 not in row:
            continue
        out[row[1]] = {header[x]: v for x, v in row.items() if x in header}
    return out


def read_action_points(war3_root: str, specs: List[dict]) -> Dict[str, Dict[str, float]]:
    """`{unit key: {clip key: seconds}}` from the Warcraft III unit weapon table."""
    rows = read_slk_rows(os.path.join(war3_root, "units", "unitweapons.slk"))
    out: Dict[str, Dict[str, float]] = {}
    for spec in specs:
        key = spec["key"]
        unit_id = spec.get("unit_id") or UNIT_IDS[key]
        row = rows.get(unit_id)
        if row is None:
            raise ValueError(f"unit id {unit_id!r} ({key}) missing from units/unitweapons.slk")
        points: Dict[str, float] = {}
        for clip, column in ACTION_POINT_COLUMN.items():
            try:
                seconds = float(row.get(column, ""))
            except ValueError:
                continue
            if seconds > 0:
                points[clip] = seconds
        out[key] = points
    return out


# ============================================================================
# Track sampling
# ============================================================================

def uniform_times(s: float, e: float) -> List[float]:
    n = max(1, int(math.ceil((e - s) / (1000.0 / SAMPLE_HZ))))
    return [s + (e - s) * i / n for i in range(n + 1)]


def sample_track(
    track: Optional[mdx.AnimTrack],
    seq: Tuple[int, int],
    end_ms: float,
    glbs: List[int],
    default: np.ndarray,
    is_quat: bool = False,
) -> Optional[Tuple[List[float], List[np.ndarray], str]]:
    """Samples one MDX track inside `[seq.start, end_ms]`; `None` means "keeps its default"."""
    if track is None or len(track.times) == 0:
        return None
    s = float(seq[0])
    if track.global_seq_id >= 0:
        times = uniform_times(s, end_ms)
    else:
        keys = [float(t) for t in track.times if seq[0] <= t <= seq[1]]
        if not keys:
            return None
        base = sorted({s, end_ms, *[k for k in keys if k <= end_ms]})
        times = []
        for i, t in enumerate(base):
            times.append(t)
            if track.interp_type >= 2 and not is_quat and i + 1 < len(base):
                nxt = base[i + 1]
                # Curved (Hermite / Bezier) segments are subdivided so linear playback stays close.
                parts = max(2, int(math.ceil((nxt - t) / CURVE_STEP_MS)))
                for k in range(1, parts):
                    times.append(t + (nxt - t) * k / parts)
    vals = [np.array(mdx.eval_track(track, t, seq, glbs, default, is_quat), dtype=np.float32) for t in times]
    interp = "STEP" if track.interp_type == 0 else "LINEAR"
    return [t - s for t in times], vals, interp


# ============================================================================
# Intermediate representation
# ============================================================================

class Layer:
    def __init__(self, filter_mode: int, unshaded: bool, image: Optional[int], color=(1.0, 1.0, 1.0),
                 alpha: float = 1.0, tex_anim: int = -1) -> None:
        self.filter_mode = filter_mode
        self.unshaded = unshaded
        self.image = image
        self.color = color
        self.alpha = alpha
        self.tex_anim = tex_anim


class Geoset:
    def __init__(self, positions, normals, uvs, joints, weights, indices, layers: List[Layer],
                 alpha: float = 1.0, color=(1.0, 1.0, 1.0)) -> None:
        self.positions = np.asarray(positions, dtype=np.float32)
        self.normals = np.asarray(normals, dtype=np.float32)
        self.uvs = np.asarray(uvs, dtype=np.float32)
        self.joints = np.asarray(joints, dtype=np.uint16)
        self.weights = np.asarray(weights, dtype=np.float32)
        self.indices = np.asarray(indices, dtype=np.uint16)
        self.layers = layers
        self.alpha = alpha
        self.color = color


class Clip:
    def __init__(self, name: str, source: str, duration_ms: float, loop: bool, move_speed: float) -> None:
        self.name = name
        self.source = source
        self.duration_ms = duration_ms
        self.loop = loop
        self.move_speed = move_speed
        self.node: Dict[Tuple[int, str], Channel] = {}
        self.geoset_alpha: Dict[int, Channel] = {}
        self.layer_alpha: Dict[Tuple[int, int], Channel] = {}
        self.geoset_color: Dict[int, Channel] = {}
        self.tex_offset: Dict[int, Channel] = {}


class UnitModel:
    def __init__(self) -> None:
        self.node_names: List[str] = []
        self.node_parents: List[int] = []
        self.node_pivots: List[np.ndarray] = []
        self.node_billboard: List[bool] = []
        self.geosets: List[Geoset] = []
        self.images: List[np.ndarray] = []
        self.clips: List[Clip] = []

    def add_node(self, name: str, parent: int, pivot, billboard: bool = False) -> int:
        self.node_names.append(name)
        self.node_parents.append(parent)
        self.node_pivots.append(np.asarray(pivot, dtype=np.float32))
        self.node_billboard.append(billboard)
        return len(self.node_names) - 1

    def rest_translation(self, idx: int) -> np.ndarray:
        p = self.node_parents[idx]
        return self.node_pivots[idx] - (self.node_pivots[p] if p >= 0 else 0.0)

    def add_image(self, rgba: np.ndarray) -> int:
        self.images.append(np.ascontiguousarray(rgba, dtype=np.uint8))
        return len(self.images) - 1


def radial_texture(size: int = 64, power: float = 1.65) -> np.ndarray:
    ys, xs = np.mgrid[0:size, 0:size].astype(np.float32)
    c = (size - 1) / 2.0
    d = np.minimum(1.0, np.hypot(xs - c, ys - c) / c)
    v = np.clip(((1.0 - d) ** power) * 255.0, 0, 255).astype(np.uint8)
    out = np.zeros((size, size, 4), dtype=np.uint8)
    out[:, :, 0] = out[:, :, 1] = out[:, :, 2] = v
    out[:, :, 3] = v
    return out


def disc_texture(size: int = 32) -> np.ndarray:
    ys, xs = np.mgrid[0:size, 0:size].astype(np.float32)
    c = (size - 1) / 2.0
    d = np.hypot(xs - c, ys - c) / c
    out = np.full((size, size, 4), 245, dtype=np.uint8)
    out[:, :, 3] = np.where(d <= 0.92, 255, 0).astype(np.uint8)
    return out


def billboard_quad(node: int, pivot: np.ndarray, radius: float, layers: List[Layer], alpha: float = 1.0) -> Geoset:
    """A quad in the node's local YZ plane; the runtime turns the node's +X towards the camera."""
    p = np.asarray(pivot, dtype=np.float32)
    pos = [p + (0, -radius, radius), p + (0, radius, radius), p + (0, -radius, -radius), p + (0, radius, -radius)]
    uv = [(0, 0), (1, 0), (0, 1), (1, 1)]
    nrm = [(1, 0, 0)] * 4
    joints = [(node, 0, 0, 0)] * 4
    weights = [(1, 0, 0, 0)] * 4
    return Geoset(pos, nrm, uv, joints, weights, [0, 1, 2, 2, 1, 3], layers, alpha=alpha)


def build_unit_model(war3_root: str, spec: dict, tex_cache: mdx.BlpTextureCache) -> UnitModel:
    key = spec["key"]
    m = mdx.load_mdx_model(os.path.join(war3_root, spec["mdx"]))
    out = UnitModel()

    oids = sorted(m.nodes)
    idx_of = {oid: i for i, oid in enumerate(oids)}
    for oid in oids:
        nd = m.nodes[oid]
        pivot = m.pivots[oid] if oid < len(m.pivots) else np.zeros(3, dtype=np.float32)
        out.add_node(nd.name.strip() or f"node{oid}", -1, pivot, bool(nd.flags & 0x8))
    for oid in oids:
        nd = m.nodes[oid]
        if nd.parent_id >= 0 and nd.parent_id != oid and nd.parent_id in idx_of:
            out.node_parents[idx_of[oid]] = idx_of[nd.parent_id]

    # ---- clips -------------------------------------------------------------
    clip_defs = clip_defs_for(spec)
    has_birth = any(s.name.lower().startswith("birth") for s in m.sequences)
    zero3 = np.zeros(3, dtype=np.float32)
    one3 = np.ones(3, dtype=np.float32)
    id_q = np.array([0, 0, 0, 1], dtype=np.float32)
    clip_ranges: List[Tuple[Tuple[int, int], float]] = []

    for c_key, seq_names, loop in clip_defs:
        seq = find_clip_sequence(m, spec["key"], c_key, seq_names)
        rng = (seq.start_ms, seq.end_ms)
        end_ms = float(seq.end_ms)
        if c_key == "dt" and not spec.get("phylactery"):
            end_ms = mdx.find_visible_death_end_ms(m, seq)
        if c_key == "gh":
            end_ms = min(end_ms, seq.start_ms + HIT_CLIP_MS)
        clip = Clip(c_key, seq.name, end_ms - seq.start_ms, loop, float(seq.move_speed))
        clip_ranges.append((rng, end_ms))

        for oid in oids:
            nd = m.nodes[oid]
            ni = idx_of[oid]
            tr = sample_track(nd.kgtr, rng, end_ms, m.global_seqs, zero3)
            if tr is not None:
                base = out.rest_translation(ni)
                clip.node[(ni, "translation")] = (tr[0], [list(map(float, base + v)) for v in tr[1]], tr[2])
            rt = sample_track(nd.kgrt, rng, end_ms, m.global_seqs, id_q, is_quat=True)
            if rt is not None:
                vals = []
                for q in rt[1]:
                    n = float(np.linalg.norm(q))
                    vals.append(list(map(float, q / n if n > 1e-8 else id_q)))
                clip.node[(ni, "rotation")] = (rt[0], vals, rt[2])
            sc = sample_track(nd.kgsc, rng, end_ms, m.global_seqs, one3)
            if sc is not None:
                clip.node[(ni, "scale")] = (sc[0], [list(map(float, v)) for v in sc[1]], sc[2])

        # Units without a native Birth sequence rise out of the ground while summoned.
        if c_key == "s1" and not has_birth:
            add_root_offset(out, clip, lambda phase: (0.0, 0.0, -(1.0 - phase) * 58.0))
        # Warcraft III has no hit-recovery animation: a short idle slice gets a backwards recoil.
        if c_key == "gh":
            add_root_offset(out, clip, lambda phase: (-HIT_RECOIL_UNITS * math.sin(math.pi * phase), 0.0, 0.0))

        for gi in range(len(m.geosets)):
            ga = m.geoset_anims.get(gi)
            if ga is None:
                continue
            a = sample_track(ga.kgao, rng, end_ms, m.global_seqs, np.array([ga.alpha], dtype=np.float32))
            if a is not None:
                clip.geoset_alpha[gi] = (a[0], [[float(v[0])] for v in a[1]], a[2])
            base_col = np.clip(ga.color, 0.0, 2.0) if ga.flags & 2 else one3
            col = sample_track(ga.kgac, rng, end_ms, m.global_seqs, base_col)
            if col is not None:
                clip.geoset_color[gi] = (col[0], [list(map(float, np.clip(v, 0.0, 2.0))) for v in col[1]], col[2])

        for gi, geo in enumerate(m.geosets):
            layers = m.materials[geo.material_id] if geo.material_id < len(m.materials) else []
            for li, layer in enumerate(layers):
                la = sample_track(layer.kmta, rng, end_ms, m.global_seqs, np.array([layer.alpha], dtype=np.float32))
                if la is not None:
                    clip.layer_alpha[(gi, li)] = (la[0], [[float(v[0])] for v in la[1]], la[2])

        for ti, ta in enumerate(m.tex_anims):
            off = sample_track(ta.ktat, rng, end_ms, m.global_seqs, zero3)
            if off is not None:
                clip.tex_offset[ti] = (off[0], [[float(v[0]), float(v[1])] for v in off[1]], off[2])

        out.clips.append(clip)

    # ---- geosets (dropping ones that never become visible in any exported clip) ----
    image_of: Dict[str, int] = {}

    def image_for(tex: mdx.MdxTexture) -> Optional[int]:
        if tex.replaceable_id in (1, 2):
            name = f"replaceable:{tex.replaceable_id}"
            arr = tex_cache.get_replaceable(tex.replaceable_id)
        elif tex.file_name:
            name = tex.file_name.replace("\\", "/").lower()
            arr = tex_cache.load(tex.file_name)
        else:
            return None
        if name not in image_of:
            image_of[name] = out.add_image(arr)
        return image_of[name]

    geoset_remap: Dict[int, int] = {}
    for gi, geo in enumerate(m.geosets):
        ga = m.geoset_anims.get(gi)
        static_alpha = float(ga.alpha) if ga is not None else 1.0
        visible = False
        for clip in out.clips:
            ch = clip.geoset_alpha.get(gi)
            if (max(v[0] for v in ch[1]) if ch is not None else static_alpha) > 0.02:
                visible = True
                break
        if not visible:
            continue
        src_layers = m.materials[geo.material_id] if geo.material_id < len(m.materials) else []
        layers: List[Layer] = []
        layer_remap: Dict[int, int] = {}
        for li, layer in enumerate(src_layers):
            if layer.filter_mode > 4 or not (0 <= layer.texture_id < len(m.textures)):
                continue
            tex = m.textures[layer.texture_id]
            img = image_for(tex)
            if img is None:
                continue
            alpha = layer.alpha
            # Large flat hero-glow ground decals are attenuated so they do not wash the unit out.
            if tex.replaceable_id == 2 and layer.filter_mode in (3, 4):
                alpha *= 0.42
            layer_remap[li] = len(layers)
            layers.append(Layer(layer.filter_mode, bool(layer.shading_flags & 1) or layer.filter_mode in (3, 4),
                                img, alpha=alpha,
                                tex_anim=layer.tex_anim_id if 0 <= layer.tex_anim_id < len(m.tex_anims) else -1))
        if not layers:
            continue

        # glTF carries four influences per JOINTS_n / WEIGHTS_n set; vertices bound to more than
        # four bones get a second set instead of being truncated.
        widest = max((len(grp) for grp in geo.matrix_groups), default=0)
        if widest > 8:
            raise ValueError(f"{key}: geoset {gi} binds a vertex to {widest} bones (at most 8 are supported)")
        influences = 8 if widest > 4 else 4
        joints = np.zeros((len(geo.vertices), influences), dtype=np.uint16)
        weights = np.zeros((len(geo.vertices), influences), dtype=np.float32)
        for vi, grp_idx in enumerate(geo.vertex_groups):
            grp = [idx_of[b] for b in geo.matrix_groups[grp_idx] if b in idx_of]
            if not grp:
                raise ValueError(f"{key}: geoset {gi} vertex {vi} has no bones")
            for k, b in enumerate(grp):
                joints[vi, k] = b
                weights[vi, k] = 1.0 / len(grp)
        color = tuple(map(float, np.clip(ga.color, 0.0, 2.0))) if (ga is not None and ga.flags & 2) else (1.0, 1.0, 1.0)
        new_gi = len(out.geosets)
        geoset_remap[gi] = new_gi
        out.geosets.append(Geoset(geo.vertices, geo.normals, geo.uvs, joints, weights,
                                  geo.triangles.reshape(-1), layers, alpha=static_alpha, color=color))
        for clip in out.clips:
            for (g, l) in list(clip.layer_alpha):
                if g == gi:
                    ch = clip.layer_alpha.pop((g, l))
                    if l in layer_remap:
                        scale = layers[layer_remap[l]].alpha / max(1e-6, src_layers[l].alpha)
                        clip.layer_alpha[(-(new_gi + 1), layer_remap[l])] = (
                            ch[0], [[v[0] * scale] for v in ch[1]], ch[2])

    for clip in out.clips:
        clip.geoset_alpha = {geoset_remap[g]: c for g, c in clip.geoset_alpha.items() if g in geoset_remap}
        clip.geoset_color = {geoset_remap[g]: c for g, c in clip.geoset_color.items() if g in geoset_remap}
        clip.layer_alpha = {(-(g) - 1, l): c for (g, l), c in clip.layer_alpha.items() if g < 0}

    if spec.get("phylactery"):
        add_phylactery(out)
    if spec.get("extra_orb"):
        add_element_orb(out, spec["extra_orb"])
    return out


def add_root_offset(out: UnitModel, clip: Clip, offset_at) -> None:
    """Adds a model-space offset (a function of clip phase 0..1) to every root node."""
    times = uniform_times(0.0, clip.duration_ms)
    for ni, parent in enumerate(out.node_parents):
        if parent >= 0:
            continue
        existing = clip.node.get((ni, "translation"))
        vals = []
        for t in times:
            phase = t / max(1.0, clip.duration_ms)
            base = (np.array(sample_channel(existing, t), dtype=np.float32)
                    if existing is not None else out.rest_translation(ni))
            vals.append(list(map(float, base + np.array(offset_at(phase), dtype=np.float32))))
        clip.node[(ni, "translation")] = (times, vals, "LINEAR")


def sample_channel(ch: Channel, t: float) -> List[float]:
    times, vals, interp = ch
    if t <= times[0]:
        return vals[0]
    if t >= times[-1]:
        return vals[-1]
    hi = int(np.searchsorted(np.asarray(times), t, side="right"))
    lo = hi - 1
    if interp == "STEP" or times[hi] <= times[lo]:
        return vals[lo]
    u = (t - times[lo]) / (times[hi] - times[lo])
    return [a + (b - a) * u for a, b in zip(vals[lo], vals[hi])]


def add_phylactery(out: UnitModel) -> None:
    """Kel'Thuzad's hovering frost phylactery, revealed in the second half of the death clip."""
    node = out.add_node("Phylactery", -1, (0.0, 0.0, 36.0))
    halo_node = out.add_node("PhylacteryHalo", node, (0.0, 0.0, 36.0), billboard=True)
    c = np.array([0.0, 0.0, 36.0], dtype=np.float32)
    r_xy, r_z = 11.5, 21.0
    top, bot = c + (0, 0, r_z), c + (0, 0, -r_z)
    ring = [c + (r_xy, 0, 0), c + (0, r_xy, 0), c + (-r_xy, 0, 0), c + (0, -r_xy, 0)]

    def flat(tris):
        pos, nrm = [], []
        for a, b, d in tris:
            n = np.cross(b - a, d - a)
            n = n / max(1e-6, float(np.linalg.norm(n)))
            pos += [a, b, d]
            nrm += [n, n, n]
        k = len(pos)
        return Geoset(pos, nrm, [(0.5, 0.5)] * k, [(node, 0, 0, 0)] * k, [(1, 0, 0, 0)] * k, list(range(k)), [], alpha=0.0)

    upper, lower, gold = [], [], []
    for k in range(4):
        a, b = ring[k], ring[(k + 1) % 4]
        upper.append((top, a, b))
        lower.append((bot, b, a))
        ha, hb = a * 0.72 + top * 0.28, b * 0.72 + top * 0.28
        ha2, hb2 = a * 0.52 + top * 0.48, b * 0.52 + top * 0.48
        gold += [(ha * 1.04, hb * 1.04, hb2 * 1.04), (ha * 1.04, hb2 * 1.04, ha2 * 1.04)]
    for tris, col, glow in ((upper, (115, 228, 255), True), (lower, (75, 185, 245), True), (gold, (224, 182, 78), False)):
        g = flat(tris)
        g.layers.append(Layer(0, False, None, color=tuple(v / 255.0 for v in col)))
        if glow:
            g.layers.append(Layer(3, True, None, color=(75 / 255.0, 205 / 255.0, 1.0), alpha=0.85))
        out.geosets.append(g)
    halo_img = out.add_image(radial_texture(64, 2.0))
    out.geosets.append(billboard_quad(halo_node, c, 28.0, [Layer(4, True, halo_img, color=(70 / 255.0, 195 / 255.0, 1.0))], alpha=0.0))
    first = len(out.geosets) - 4

    for clip in out.clips:
        if clip.name != "dt":
            continue
        times = uniform_times(0.0, clip.duration_ms)
        strength, trans, scale = [], [], []
        for t in times:
            phase = t / max(1.0, clip.duration_ms)
            s = 0.0 if phase < 0.42 else min(1.0, (phase - 0.42) / 0.45)
            strength.append([s])
            trans.append([0.0, 0.0, 36.0 + 4.0 * math.sin(phase * math.pi * 4.0)])
            k = 0.55 + 0.45 * s
            scale.append([k, k, k])
        clip.node[(node, "translation")] = (times, trans, "LINEAR")
        clip.node[(node, "scale")] = (times, scale, "LINEAR")
        for gi in range(first, first + 4):
            clip.geoset_alpha[gi] = (times, strength, "LINEAR")


def add_element_orb(out: UnitModel, node_substr: str) -> None:
    """Neutral white staff orb for the Necromancer; the runtime tints the glow by element."""
    parent = next((i for i, n in enumerate(out.node_names) if node_substr.lower() in n.lower()), None)
    if parent is None:
        raise ValueError(f"orb anchor node containing {node_substr!r} not found")
    pivot = out.node_pivots[parent] + np.array([0.0, 0.0, 4.0], dtype=np.float32)
    node = out.add_node("ElementOrb", parent, pivot, billboard=True)
    glow_img = out.add_image(radial_texture(64, 1.65))
    core_img = out.add_image(disc_texture(32))
    first = len(out.geosets)
    out.geosets.append(billboard_quad(node, pivot, 15.5, [Layer(4, True, glow_img)]))
    out.geosets.append(billboard_quad(node, pivot, 3.8, [Layer(1, True, core_img)]))
    for clip in out.clips:
        if clip.name == "dt":
            cut = clip.duration_ms * 0.7
            for gi in (first, first + 1):
                clip.geoset_alpha[gi] = ([0.0, cut, clip.duration_ms], [[1.0], [0.0], [0.0]], "STEP")


# ============================================================================
# GLB writer
# ============================================================================

class GlbBuilder:
    def __init__(self) -> None:
        self.bin = bytearray()
        self.views: List[dict] = []
        self.accessors: List[dict] = []

    def view(self, data: bytes, target: Optional[int] = None) -> int:
        while len(self.bin) % 4:
            self.bin.append(0)
        v = {"buffer": 0, "byteOffset": len(self.bin), "byteLength": len(data)}
        if target is not None:
            v["target"] = target
        self.bin += data
        self.views.append(v)
        return len(self.views) - 1

    def accessor(self, arr: np.ndarray, comp: int, typ: str, target: Optional[int] = None, minmax: bool = False) -> int:
        arr = np.ascontiguousarray(arr)
        acc = {"bufferView": self.view(arr.tobytes(), target), "componentType": comp,
               "count": int(arr.shape[0]), "type": typ}
        if minmax:
            flat = arr.reshape(arr.shape[0], -1)
            acc["min"] = [float(v) for v in flat.min(axis=0)]
            acc["max"] = [float(v) for v in flat.max(axis=0)]
        self.accessors.append(acc)
        return len(self.accessors) - 1


def png_bytes(rgba: np.ndarray) -> bytes:
    bio = io.BytesIO()
    Image.fromarray(rgba, "RGBA").save(bio, "PNG", optimize=True)
    return bio.getvalue()


def write_glb(model: UnitModel, path: str) -> None:
    b = GlbBuilder()
    F, U16 = 5126, 5123
    n_nodes = len(model.node_names)

    nodes = []
    for i in range(n_nodes):
        nd = {"name": model.node_names[i], "translation": [float(v) for v in model.rest_translation(i)]}
        kids = [k for k in range(n_nodes) if model.node_parents[k] == i]
        if kids:
            nd["children"] = kids
        if model.node_billboard[i]:
            nd["extras"] = {"billboard": True}
        nodes.append(nd)
    roots = [i for i in range(n_nodes) if model.node_parents[i] < 0]

    ibm = np.tile(np.eye(4, dtype=np.float32), (n_nodes, 1, 1))
    for i in range(n_nodes):
        ibm[i, :3, 3] = -model.node_pivots[i]
    # glTF matrices are column-major.
    ibm_acc = b.accessor(np.ascontiguousarray(ibm.transpose(0, 2, 1)).reshape(n_nodes, 16), F, "MAT4")

    images, textures = [], []
    for img in model.images:
        images.append({"bufferView": b.view(png_bytes(img)), "mimeType": "image/png"})
        textures.append({"source": len(images) - 1, "sampler": 0})

    materials, primitives = [], []
    for gi, geo in enumerate(model.geosets):
        attrs = {
            "POSITION": b.accessor(geo.positions, F, "VEC3", 34962, minmax=True),
            "NORMAL": b.accessor(geo.normals, F, "VEC3", 34962),
            "TEXCOORD_0": b.accessor(geo.uvs, F, "VEC2", 34962),
            "JOINTS_0": b.accessor(geo.joints[:, :4], U16, "VEC4", 34962),
            "WEIGHTS_0": b.accessor(geo.weights[:, :4], F, "VEC4", 34962),
        }
        if geo.joints.shape[1] > 4:
            attrs["JOINTS_1"] = b.accessor(geo.joints[:, 4:8], U16, "VEC4", 34962)
            attrs["WEIGHTS_1"] = b.accessor(geo.weights[:, 4:8], F, "VEC4", 34962)
        idx = b.accessor(geo.indices, U16, "SCALAR", 34963)
        for li, layer in enumerate(geo.layers):
            pbr = {"baseColorFactor": [float(layer.color[0]), float(layer.color[1]), float(layer.color[2]), float(layer.alpha)],
                   "metallicFactor": 0.0, "roughnessFactor": 1.0}
            if layer.image is not None:
                pbr["baseColorTexture"] = {"index": layer.image}
            mat = {"pbrMetallicRoughness": pbr, "doubleSided": True,
                   "alphaMode": "OPAQUE" if layer.filter_mode == 0 else ("MASK" if layer.filter_mode == 1 else "BLEND"),
                   "extras": {"filterMode": layer.filter_mode, "unshaded": layer.unshaded, "texAnim": layer.tex_anim}}
            if layer.filter_mode == 1:
                mat["alphaCutoff"] = 0.65
            materials.append(mat)
            primitives.append({"attributes": attrs, "indices": idx, "material": len(materials) - 1,
                               "extras": {"geoset": gi, "layer": li, "alpha": float(geo.alpha),
                                          "color": [float(v) for v in geo.color]}})

    def chan(ch: Channel, typ: str) -> dict:
        times = np.asarray(ch[0], dtype=np.float32).reshape(-1, 1) / 1000.0
        vals = np.asarray(ch[1], dtype=np.float32)
        return {"input": b.accessor(times, F, "SCALAR", minmax=True), "output": b.accessor(vals, F, typ),
                "interpolation": ch[2]}

    animations = []
    for clip in model.clips:
        samplers, channels = [], []
        for (ni, prop), ch in sorted(clip.node.items()):
            samplers.append(chan(ch, "VEC4" if prop == "rotation" else "VEC3"))
            channels.append({"sampler": len(samplers) - 1, "target": {"node": ni, "path": prop}})
        extras = {
            "durationMs": float(clip.duration_ms), "loop": clip.loop, "moveSpeed": float(clip.move_speed),
            "source": clip.source,
            "geosetAlpha": [{"geoset": g, **chan(c, "SCALAR")} for g, c in sorted(clip.geoset_alpha.items())],
            "layerAlpha": [{"geoset": g, "layer": l, **chan(c, "SCALAR")} for (g, l), c in sorted(clip.layer_alpha.items())],
            "geosetColor": [{"geoset": g, **chan(c, "VEC3")} for g, c in sorted(clip.geoset_color.items())],
            "texOffset": [{"texAnim": t, **chan(c, "VEC2")} for t, c in sorted(clip.tex_offset.items())],
        }
        anim = {"name": clip.name, "extras": extras}
        if channels:
            anim["samplers"] = samplers
            anim["channels"] = channels
        else:
            # glTF requires >= 1 channel; a static clip animates the first root with its rest pose.
            r = roots[0]
            rest = [float(v) for v in model.rest_translation(r)]
            anim["samplers"] = [chan(([0.0, clip.duration_ms], [rest, rest], "LINEAR"), "VEC3")]
            anim["channels"] = [{"sampler": 0, "target": {"node": r, "path": "translation"}}]
        animations.append(anim)

    mesh_node = len(nodes)
    nodes.append({"name": "mesh", "mesh": 0, "skin": 0})
    gltf = {
        "asset": {"version": "2.0", "generator": "d2web-skin-baker"},
        "scene": 0,
        "scenes": [{"nodes": roots + [mesh_node]}],
        "nodes": nodes,
        "meshes": [{"primitives": primitives}],
        "skins": [{"joints": list(range(n_nodes)), "inverseBindMatrices": ibm_acc}],
        "materials": materials,
        "animations": animations,
        "accessors": b.accessors,
        "bufferViews": b.views,
        "buffers": [{"byteLength": 0}],
        "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 10497, "wrapT": 10497}],
    }
    if images:
        gltf["images"] = images
        gltf["textures"] = textures
    extras = getattr(model, "extras", None)
    if extras:
        gltf["extras"] = extras
    while len(b.bin) % 4:
        b.bin.append(0)
    gltf["buffers"][0]["byteLength"] = len(b.bin)
    js = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    js += b" " * ((4 - len(js) % 4) % 4)
    total = 12 + 8 + len(js) + 8 + len(b.bin)
    with open(path, "wb") as f:
        f.write(struct.pack("<4sII", b"glTF", 2, total))
        f.write(struct.pack("<I4s", len(js), b"JSON"))
        f.write(js)
        f.write(struct.pack("<I4s", len(b.bin), b"BIN\x00"))
        f.write(bytes(b.bin))


# ============================================================================
# Independent GLB re-evaluation (verifies the encoding against direct MDX skinning)
# ============================================================================

def read_glb(path: str) -> Tuple[dict, bytes]:
    data = open(path, "rb").read()
    magic, _ver, _total = struct.unpack_from("<4sII", data, 0)
    assert magic == b"glTF"
    jlen = struct.unpack_from("<I", data, 12)[0]
    gltf = json.loads(data[20:20 + jlen])
    boff = 20 + jlen
    blen = struct.unpack_from("<I", data, boff)[0]
    return gltf, data[boff + 8:boff + 8 + blen]


def read_accessor(gltf: dict, blob: bytes, idx: int) -> np.ndarray:
    acc = gltf["accessors"][idx]
    view = gltf["bufferViews"][acc["bufferView"]]
    ncomp = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}[acc["type"]]
    dtype = {5126: np.float32, 5123: np.uint16, 5121: np.uint8, 5125: np.uint32}[acc["componentType"]]
    arr = np.frombuffer(blob, dtype=dtype, count=acc["count"] * ncomp, offset=view["byteOffset"])
    return arr.reshape(acc["count"], ncomp)


def glb_skinned_positions(gltf: dict, blob: bytes, clip_name: str, t_ms: float, prim_index: int) -> np.ndarray:
    nodes = gltf["nodes"]
    joints = gltf["skins"][0]["joints"]
    n = len(joints)
    T = [np.array(nodes[j].get("translation", [0, 0, 0]), dtype=np.float64) for j in joints]
    R = [np.array([0, 0, 0, 1], dtype=np.float64) for _ in joints]
    S = [np.ones(3, dtype=np.float64) for _ in joints]
    anim = next(a for a in gltf["animations"] if a["name"] == clip_name)
    for ch in anim["channels"]:
        smp = anim["samplers"][ch["sampler"]]
        times = read_accessor(gltf, blob, smp["input"])[:, 0].astype(np.float64) * 1000.0
        vals = read_accessor(gltf, blob, smp["output"]).astype(np.float64)
        ni, path = ch["target"]["node"], ch["target"]["path"]
        if t_ms <= times[0]:
            v = vals[0]
        elif t_ms >= times[-1]:
            v = vals[-1]
        else:
            hi = int(np.searchsorted(times, t_ms, side="right"))
            lo = hi - 1
            u = (t_ms - times[lo]) / max(1e-9, times[hi] - times[lo])
            if smp["interpolation"] == "STEP":
                v = vals[lo]
            elif path == "rotation":
                v = mdx.quat_slerp(vals[lo].astype(np.float32), vals[hi].astype(np.float32), float(u)).astype(np.float64)
            else:
                v = vals[lo] + (vals[hi] - vals[lo]) * u
        if path == "translation":
            T[ni] = v
        elif path == "rotation":
            R[ni] = v
        else:
            S[ni] = v
    parent = [-1] * len(nodes)
    for i, nd in enumerate(nodes):
        for k in nd.get("children", []):
            parent[k] = i
    glob: Dict[int, np.ndarray] = {}

    def g(i: int) -> np.ndarray:
        if i in glob:
            return glob[i]
        loc = np.eye(4)
        loc[:3, :3] = mdx.quat_to_mat3(R[i].astype(np.float32)).astype(np.float64) * S[i][None, :]
        loc[:3, 3] = T[i]
        glob[i] = g(parent[i]) @ loc if parent[i] >= 0 else loc
        return glob[i]

    ibm = read_accessor(gltf, blob, gltf["skins"][0]["inverseBindMatrices"]).reshape(n, 4, 4).transpose(0, 2, 1)
    mats = np.stack([g(j) @ ibm[k] for k, j in enumerate(joints)])
    prim = gltf["meshes"][0]["primitives"][prim_index]
    pos = read_accessor(gltf, blob, prim["attributes"]["POSITION"]).astype(np.float64)
    jn = read_accessor(gltf, blob, prim["attributes"]["JOINTS_0"])
    wt = read_accessor(gltf, blob, prim["attributes"]["WEIGHTS_0"]).astype(np.float64)
    if "JOINTS_1" in prim["attributes"]:
        jn = np.concatenate([jn, read_accessor(gltf, blob, prim["attributes"]["JOINTS_1"])], axis=1)
        wt = np.concatenate([wt, read_accessor(gltf, blob, prim["attributes"]["WEIGHTS_1"]).astype(np.float64)], axis=1)
    homo = np.concatenate([pos, np.ones((len(pos), 1))], axis=1)
    out = np.zeros((len(pos), 3))
    for k in range(jn.shape[1]):
        out += wt[:, k:k + 1] * np.einsum("vij,vj->vi", mats[jn[:, k]], homo)[:, :3]
    return out


def verify_unit(war3_root: str, spec: dict, glb_path: str) -> float:
    """Max position error between GLB playback and direct MDX skinning over all clips."""
    m = mdx.load_mdx_model(os.path.join(war3_root, spec["mdx"]))
    gltf, blob = read_glb(glb_path)
    clip_defs = clip_defs_for(spec)
    has_birth = any(s.name.lower().startswith("birth") for s in m.sequences)
    prims = gltf["meshes"][0]["primitives"]
    worst = 0.0
    for c_key, seq_names, _loop in clip_defs:
        seq = find_clip_sequence(m, spec["key"], c_key, seq_names)
        anim = next(a for a in gltf["animations"] if a["name"] == c_key)
        dur = anim["extras"]["durationMs"]
        for frac in (0.0, 0.137, 0.31, 0.5, 0.73, 0.91, 1.0):
            t_rel = dur * frac
            mats = mdx.evaluate_node_matrices(m, seq.start_ms + t_rel, (seq.start_ms, seq.end_ms))
            z_off = -(1.0 - frac) * 58.0 if (c_key == "s1" and not has_birth) else 0.0
            x_off = -HIT_RECOIL_UNITS * math.sin(math.pi * frac) if c_key == "gh" else 0.0
            # Original geosets are matched by vertex count + first-layer order of surviving geosets.
            pi = 0
            seen_geosets = set()
            used_sources = set()
            for prim in prims:
                gi = prim["extras"]["geoset"]
                if gi in seen_geosets or prim["extras"]["layer"] != 0:
                    pi += 1
                    continue
                seen_geosets.add(gi)
                pos_acc = read_accessor(gltf, blob, prim["attributes"]["POSITION"])
                # Surviving geosets keep their source order; several glow planes share identical
                # rest positions, so each source geoset may only be matched once.
                src_idx = next((k for k, g in enumerate(m.geosets)
                                if k not in used_sources and len(g.vertices) == len(pos_acc)
                                and np.allclose(g.vertices, pos_acc)), None)
                if src_idx is None:
                    pi += 1
                    continue
                used_sources.add(src_idx)
                src = m.geosets[src_idx]
                gm = []
                for grp in src.matrix_groups:
                    acc = np.zeros((4, 4), dtype=np.float64)
                    for bid in grp:
                        acc += mats.get(bid, np.eye(4))
                    gm.append(acc / max(1, len(grp)))
                vm = np.stack(gm)[src.vertex_groups]
                homo = np.concatenate([src.vertices.astype(np.float64), np.ones((len(src.vertices), 1))], axis=1)
                ref = np.einsum("vij,vj->vi", vm, homo)[:, :3]
                ref[:, 2] += z_off
                ref[:, 0] += x_off
                got = glb_skinned_positions(gltf, blob, c_key, t_rel, pi)
                err = float(np.abs(ref - got).max())
                if os.environ.get("GLB_VERIFY_DEBUG") and err > 0.5:
                    vi = int(np.abs(ref - got).max(axis=1).argmax())
                    grp = src.matrix_groups[src.vertex_groups[vi]]
                    print(f"    {c_key} frac={frac} geoset={gi} err={err:.3f} bones={[(b, m.nodes[b].name) for b in grp]}")
                worst = max(worst, err)
                pi += 1
    return worst


# ============================================================================
# Entry point
# ============================================================================

def compute_unit_box(war3_root: str, spec: dict, px: float) -> dict:
    """
    Scene-pixel box that contains the unit in every exported clip and for every facing.

    The bound is facing-independent: with horizontal reach `r` and height range `[z0, z1]`
    (model units), the isometric projection stays inside `x in [-r, r]` and
    `y in [-(r * sin + z1 * cos), r * sin - z0 * cos]` around the ground point.
    """
    key = spec["key"]
    m = mdx.load_mdx_model(os.path.join(war3_root, spec["mdx"]))
    reach, z_lo, z_hi = 1.0, 0.0, 1.0
    for c_key, seq_names, _loop in clip_defs_for(spec):
        seq = find_clip_sequence(m, spec["key"], c_key, seq_names)
        rng = (seq.start_ms, seq.end_ms)
        end_ms = float(seq.end_ms)
        if c_key == "dt" and not spec.get("phylactery"):
            end_ms = mdx.find_visible_death_end_ms(m, seq)
        if c_key == "gh":
            end_ms = min(end_ms, seq.start_ms + HIT_CLIP_MS)
        for t in np.linspace(seq.start_ms, end_ms, 13):
            mats = mdx.evaluate_node_matrices(m, float(t), rng)
            for gi, geo in enumerate(m.geosets):
                ga = m.geoset_anims.get(gi)
                alpha = (float(mdx.eval_track(ga.kgao, float(t), rng, m.global_seqs,
                                              np.array([ga.alpha], dtype=np.float32))[0])
                         if ga is not None else 1.0)
                if alpha <= 0.02:
                    continue
                # Small non-emissive camera-facing particles (blood drips) fly far from the body;
                # they may clip at the box edge rather than inflate the box for every frame.
                layers = m.materials[geo.material_id] if geo.material_id < len(m.materials) else []
                bones = {b for grp in geo.matrix_groups for b in grp}
                if (bones and all(b in m.nodes and m.nodes[b].flags & 0x8 for b in bones)
                        and not any(l.filter_mode in (3, 4) for l in layers)):
                    continue
                gm = []
                for grp in geo.matrix_groups:
                    acc = np.zeros((4, 4), dtype=np.float64)
                    for bid in grp:
                        acc += mats.get(bid, np.eye(4))
                    gm.append(acc / max(1, len(grp)))
                homo = np.concatenate([geo.vertices.astype(np.float64), np.ones((len(geo.vertices), 1))], axis=1)
                pts = np.einsum("vij,vj->vi", np.stack(gm)[geo.vertex_groups], homo)[:, :3]
                reach = max(reach, float(np.hypot(pts[:, 0], pts[:, 1]).max()))
                z_lo = min(z_lo, float(pts[:, 2].min()))
                z_hi = max(z_hi, float(pts[:, 2].max()))
    reach += HIT_RECOIL_UNITS
    if spec.get("phylactery"):
        z_hi = max(z_hi, 36.0 + 4.0 + 21.0)  # hovering phylactery
    half_w = min(BOX_MAX_PX / 2, math.ceil(reach * px) + BOX_MARGIN_PX)
    above = min(BOX_MAX_PX * 0.75, math.ceil((reach * SIN_PITCH + z_hi * COS_PITCH) * px) + BOX_MARGIN_PX)
    below = min(BOX_MAX_PX * 0.5, math.ceil((reach * SIN_PITCH - z_lo * COS_PITCH) * px) + BOX_MARGIN_PX)
    return {"width": int(half_w * 2), "height": int(above + below), "footX": int(half_w), "footY": int(above)}


def clip_meta(clip: Clip, action_seconds: Optional[float]) -> dict:
    meta = {"durationMs": round(clip.duration_ms, 2), "loop": clip.loop, "source": clip.source,
            "moveSpeed": round(clip.move_speed, 2)}
    if action_seconds is not None:
        at = action_seconds * 1000.0 / clip.duration_ms
        # An action point outside the clip (the source sequence is shorter than the unit's
        # swing time) cannot be aligned, so the clip stays linear.
        if 0.0 < at < 1.0:
            meta["actionAt"] = round(at, 4)
    return meta


def convert_all(war3_root: str, out_dir: str, verify: bool, skin: str) -> None:
    if skin not in SKINS:
        raise SystemExit(f"unknown skin {skin!r} (known: {', '.join(sorted(SKINS))})")
    os.makedirs(out_dir, exist_ok=True)
    specs = SKINS[skin]["units"]
    tex_cache = mdx.BlpTextureCache(war3_root, team_color_index=SKINS[skin]["team_color"])
    action_points = read_action_points(war3_root, specs)
    units = {}
    for spec in specs:
        key = spec["key"]
        model = build_unit_model(war3_root, spec, tex_cache)
        glb_name = f"{key}.glb"
        glb_path = os.path.join(out_dir, glb_name)
        write_glb(model, glb_path)
        portrait_name = f"portrait-{key}.png"
        with open(os.path.join(out_dir, portrait_name), "wb") as f:
            f.write(png_bytes(mdx.build_portrait_from_btn(tex_cache, spec["btn"], (92, 82))))
        px = spec.get("px") or UNIT_PX_PER_UNIT[key]
        units[key] = {
            "glb": glb_name,
            "portrait": portrait_name,
            "pxPerUnit": px,
            "box": compute_unit_box(war3_root, spec, px),
            "clips": {c.name: clip_meta(c, action_points[key].get(c.name)) for c in model.clips},
        }
        msg = f"[convert_war3_mdx_to_glb] {key}: {os.path.getsize(glb_path) / 1024:.0f} KB, " \
              f"{len(model.geosets)} geosets, {len(model.images)} textures, {len(model.clips)} clips"
        if verify:
            err = verify_unit(war3_root, spec, glb_path)
            msg += f", max playback error {err:.4f} units"
            # Tolerance of linear playback against the curved source tracks (about one scene pixel).
            if err > 3.0:
                raise SystemExit(f"{key}: GLB playback deviates from MDX skinning by {err:.4f} units")
        print(msg)
    with open(os.path.join(out_dir, "preview.png"), "wb") as f:
        f.write(png_bytes(mdx.build_portrait_from_btn(
            tex_cache, next(sp["btn"] for sp in specs if sp["key"] == "hero"), (128, 128))))
    with open(os.path.join(out_dir, "units.json"), "w", encoding="utf-8") as f:
        json.dump({"preview": "preview.png", "units": units}, f, indent=1)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--war3-dir", default=os.environ.get(
        "WAR3_MPQ_DIR", os.path.join(os.path.expanduser("~"), "d2-data", "war3-mpq")))
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--verify", action="store_true")
    ap.add_argument("--skin", default="ne-kelthuzad", choices=sorted(SKINS))
    args = ap.parse_args()
    convert_all(args.war3_dir, args.out_dir, args.verify, args.skin)


if __name__ == "__main__":
    main()

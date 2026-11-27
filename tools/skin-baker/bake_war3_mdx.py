#!/usr/bin/env python3
"""
Authentic Warcraft III MDLX (.mdx) + BLP1 (.blp) Isometric Skeletal Baker
(`tools/skin-baker/bake_war3_mdx.py`).

Reads unpacked Warcraft III assets (from `WAR3_MPQ_DIR` or `~/d2-data/war3-mpq`),
evaluates exact MDLX v800 skeletal keyframe animations (`PIVT`, `KGTR`, `KGRT`,
`KGSC`, `GEOA`, `TXAN`, `KMTA`, `KMTF`) and multi-layer `BLP1` materials
(`Opaque`, `Transparent`, `Blend` over `TeamColor`, and `Additive`/`AddAlpha` into
separate emissive `glow` frames), and emits raw frame buffers or preview sheets
consumed by `pack-skin.ts`.
"""

from __future__ import annotations
import argparse
import io
import json
import math
import os
import struct
import sys
from concurrent.futures import ProcessPoolExecutor
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import numpy as np
from PIL import Image


# ============================================================================
# 1. BLP1 Texture Decoder
# ============================================================================

class BlpTextureCache:
    def __init__(self, war3_root: str, team_color_index: int = 3) -> None:
        self.war3_root = war3_root
        self.team_color_index = team_color_index
        self._cache: Dict[str, np.ndarray] = {}

    def resolve_path(self, rel_path: str) -> str:
        clean = rel_path.replace("\\", "/").lstrip("/").lower()
        p = os.path.join(self.war3_root, clean)
        if os.path.exists(p):
            return p
        raise FileNotFoundError(f"Missing War3 texture: {clean} under {self.war3_root}")

    def get_replaceable(self, replaceable_id: int) -> np.ndarray:
        idx_str = f"{self.team_color_index:02d}"
        if replaceable_id == 1:
            return self.load(f"replaceabletextures/teamcolor/teamcolor{idx_str}.blp")
        if replaceable_id == 2:
            return self.load(f"replaceabletextures/teamglow/teamglow{idx_str}.blp")
        return np.full((8, 8, 4), 255, dtype=np.uint8)

    def load(self, rel_path: str) -> np.ndarray:
        key = rel_path.replace("\\", "/").lstrip("/").lower()
        if key in self._cache:
            return self._cache[key]
        full = self.resolve_path(key)
        arr = decode_blp1_rgba(full)
        self._cache[key] = arr
        return arr


def decode_blp1_rgba(path: str) -> np.ndarray:
    data = open(path, "rb").read()
    if data[:4] != b"BLP1":
        raise ValueError(f"Unsupported BLP header {data[:4]!r} in {path}")
    comp, alpha_bits, w, h, pic_type, _has_mips = struct.unpack_from("<6I", data, 4)
    mip_offsets = struct.unpack_from("<16I", data, 28)
    mip_sizes = struct.unpack_from("<16I", data, 92)

    if comp == 0:
        hdr_size = struct.unpack_from("<I", data, 156)[0]
        jpeg_bytes = data[160 : 160 + hdr_size] + data[mip_offsets[0] : mip_offsets[0] + mip_sizes[0]]
        im = Image.open(io.BytesIO(jpeg_bytes))
        raw = np.array(im, dtype=np.uint8)
        if im.mode == "CMYK":
            # Pillow inverts 4-channel non-Adobe CMYK JPEGs (`255 - x`); invert back to raw BGRA.
            raw = 255 - raw
        if raw.ndim == 3 and raw.shape[2] == 4:
            b, g, r, a = raw[:, :, 0], raw[:, :, 1], raw[:, :, 2], raw[:, :, 3]
            if alpha_bits == 0:
                a = np.full_like(b, 255)
            return np.stack([r, g, b, a], axis=-1)
        if raw.ndim == 3 and raw.shape[2] == 3:
            b, g, r = raw[:, :, 0], raw[:, :, 1], raw[:, :, 2]
            return np.stack([r, g, b, np.full_like(b, 255)], axis=-1)
        return np.array(im.convert("RGBA"), dtype=np.uint8)

    if comp == 1:
        pal = np.frombuffer(data, dtype=np.uint8, count=1024, offset=156).reshape(256, 4)
        body = data[mip_offsets[0] : mip_offsets[0] + mip_sizes[0]]
        n = w * h
        idx = np.frombuffer(body, dtype=np.uint8, count=n, offset=0)
        b = pal[idx, 0]
        g = pal[idx, 1]
        r = pal[idx, 2]
        if pic_type == 5:
            a = 255 - pal[idx, 3]
        elif alpha_bits == 8 and len(body) >= n * 2:
            a = np.frombuffer(body, dtype=np.uint8, count=n, offset=n)
        elif alpha_bits == 4 and len(body) >= n + (n + 1) // 2:
            packed = np.frombuffer(body, dtype=np.uint8, count=(n + 1) // 2, offset=n)
            a = np.empty(packed.size * 2, dtype=np.uint8)
            a[0::2] = (packed & 0x0F) * 17
            a[1::2] = ((packed >> 4) & 0x0F) * 17
            a = a[:n]
        elif alpha_bits == 1 and len(body) >= n + (n + 7) // 8:
            packed = np.frombuffer(body, dtype=np.uint8, count=(n + 7) // 8, offset=n)
            a = np.unpackbits(packed, bitorder="little")[:n] * 255
        else:
            a = np.full(n, 255, dtype=np.uint8)
        return np.stack([r, g, b, a], axis=-1).reshape(h, w, 4)

    raise ValueError(f"Unknown BLP1 compression={comp} in {path}")


# ============================================================================
# 2. MDLX v800 Binary Model Parser & Keyframe Track Evaluator
# ============================================================================

@dataclass
class AnimTrack:
    tag: str
    interp_type: int
    global_seq_id: int
    times: np.ndarray       # shape (K,), int32
    values: np.ndarray      # shape (K, D), float32
    in_tans: Optional[np.ndarray] = None
    out_tans: Optional[np.ndarray] = None


def parse_anim_track(buf: bytes, off: int, dim: int) -> Tuple[AnimTrack, int]:
    tag = buf[off : off + 4].decode("latin1")
    count, interp, glb_id = struct.unpack_from("<IIi", buf, off + 4)
    pos = off + 16
    times = np.empty(count, dtype=np.int32)
    values = np.empty((count, dim), dtype=np.float32)
    in_tans = np.empty((count, dim), dtype=np.float32) if interp > 1 else None
    out_tans = np.empty((count, dim), dtype=np.float32) if interp > 1 else None

    for i in range(count):
        times[i] = struct.unpack_from("<i", buf, pos)[0]
        pos += 4
        values[i] = struct.unpack_from(f"<{dim}f", buf, pos)
        pos += 4 * dim
        if interp > 1 and in_tans is not None and out_tans is not None:
            in_tans[i] = struct.unpack_from(f"<{dim}f", buf, pos)
            pos += 4 * dim
            out_tans[i] = struct.unpack_from(f"<{dim}f", buf, pos)
            pos += 4 * dim

    return AnimTrack(tag, interp, glb_id, times, values, in_tans, out_tans), pos


def quat_slerp(q0: np.ndarray, q1: np.ndarray, t: float) -> np.ndarray:
    dot = float(np.dot(q0, q1))
    if dot < 0.0:
        q1 = -q1
        dot = -dot
    if dot > 0.9995:
        res = q0 + t * (q1 - q0)
        n = float(np.linalg.norm(res))
        return res / n if n > 1e-8 else np.array([0.0, 0.0, 0.0, 1.0], dtype=np.float32)
    theta_0 = math.acos(min(1.0, max(-1.0, dot)))
    sin_0 = math.sin(theta_0)
    theta = theta_0 * t
    s0 = math.cos(theta) - dot * math.sin(theta) / sin_0
    s1 = math.sin(theta) / sin_0
    return (s0 * q0 + s1 * q1).astype(np.float32)


def eval_track(
    track: Optional[AnimTrack],
    t_ms: float,
    seq_range: Tuple[int, int],
    global_seqs: List[int],
    default_val: np.ndarray,
    is_quat: bool = False,
) -> np.ndarray:
    if track is None or len(track.times) == 0:
        return default_val

    if track.global_seq_id >= 0 and track.global_seq_id < len(global_seqs):
        dur = global_seqs[track.global_seq_id]
        t = float(t_ms % dur) if dur > 0 else 0.0
        s_start, s_end = 0, max(0, dur)
    else:
        t = float(t_ms)
        s_start, s_end = seq_range

    times = track.times
    vals = track.values

    # Filter keys within [s_start, s_end]
    idx_hi = int(np.searchsorted(times, t, side="right"))
    idx_lo = idx_hi - 1

    # Check if sequence has ANY keyframe inside [s_start, s_end]; if none, WC3 uses default!
    first_in_seq = int(np.searchsorted(times, s_start, side="left"))
    if first_in_seq >= len(times) or times[first_in_seq] > s_end:
        return default_val

    if idx_lo < first_in_seq:
        return vals[first_in_seq]
    if idx_hi >= len(times) or times[idx_hi] > s_end:
        if times[idx_lo] < s_start:
            return default_val
        return vals[idx_lo]

    t0 = float(times[idx_lo])
    t1 = float(times[idx_hi])
    if track.interp_type == 0 or t1 <= t0:
        return vals[idx_lo]

    u = (t - t0) / (t1 - t0)
    v0 = vals[idx_lo]
    v1 = vals[idx_hi]

    if is_quat:
        return quat_slerp(v0, v1, u)

    if track.interp_type == 1 or track.in_tans is None or track.out_tans is None:
        return (v0 + (v1 - v0) * u).astype(np.float32)

    # Hermite (2) or Bezier (3)
    u2 = u * u
    u3 = u2 * u
    out0 = track.out_tans[idx_lo]
    in1 = track.in_tans[idx_hi]
    if track.interp_type == 2:
        h00 = 2 * u3 - 3 * u2 + 1
        h10 = u3 - 2 * u2 + u
        h01 = -2 * u3 + 3 * u2
        h11 = u3 - u2
        return (h00 * v0 + h10 * out0 + h01 * v1 + h11 * in1).astype(np.float32)
    # Bezier
    inv = 1.0 - u
    return (
        (inv ** 3) * v0
        + 3 * u * (inv ** 2) * out0
        + 3 * u2 * inv * in1
        + u3 * v1
    ).astype(np.float32)


@dataclass
class MdxSequence:
    name: str
    start_ms: int
    end_ms: int
    non_looping: bool
    move_speed: float = 0.0


@dataclass
class MdxTexture:
    replaceable_id: int
    file_name: str
    flags: int


@dataclass
class MdxLayer:
    filter_mode: int
    shading_flags: int
    texture_id: int
    tex_anim_id: int
    coord_id: int
    alpha: float
    kmta: Optional[AnimTrack] = None
    kmtf: Optional[AnimTrack] = None


@dataclass
class MdxGeoset:
    vertices: np.ndarray        # (V, 3)
    normals: np.ndarray         # (V, 3)
    triangles: np.ndarray       # (T, 3) int32
    vertex_groups: np.ndarray   # (V,) uint8
    matrix_groups: List[List[int]]
    material_id: int
    uvs: np.ndarray             # (V, 2)


@dataclass
class MdxGeosetAnim:
    geoset_id: int
    alpha: float
    flags: int
    color: np.ndarray           # (3,) RGB float32
    kgao: Optional[AnimTrack] = None
    kgac: Optional[AnimTrack] = None


@dataclass
class MdxNode:
    name: str
    object_id: int
    parent_id: int
    flags: int
    kgtr: Optional[AnimTrack] = None
    kgrt: Optional[AnimTrack] = None
    kgsc: Optional[AnimTrack] = None


@dataclass
class MdxTexAnim:
    ktat: Optional[AnimTrack] = None


@dataclass
class MdxModel:
    sequences: List[MdxSequence] = field(default_factory=list)
    global_seqs: List[int] = field(default_factory=list)
    textures: List[MdxTexture] = field(default_factory=list)
    materials: List[List[MdxLayer]] = field(default_factory=list)
    tex_anims: List[MdxTexAnim] = field(default_factory=list)
    geosets: List[MdxGeoset] = field(default_factory=list)
    geoset_anims: Dict[int, MdxGeosetAnim] = field(default_factory=dict)
    nodes: Dict[int, MdxNode] = field(default_factory=dict)
    pivots: np.ndarray = field(default_factory=lambda: np.zeros((0, 3), dtype=np.float32))


def parse_node_header(chunk: bytes, off: int) -> Tuple[MdxNode, int]:
    inc_size = struct.unpack_from("<I", chunk, off)[0]
    end_off = off + inc_size
    name = chunk[off + 4 : off + 84].split(b"\x00", 1)[0].decode("latin1")
    obj_id, parent_id, flags = struct.unpack_from("<iiI", chunk, off + 84)
    pos = off + 96
    kgtr = kgrt = kgsc = None
    while pos < end_off:
        stag = chunk[pos : pos + 4].decode("latin1")
        if stag == "KGTR":
            kgtr, pos = parse_anim_track(chunk, pos, 3)
        elif stag == "KGRT":
            kgrt, pos = parse_anim_track(chunk, pos, 4)
        elif stag == "KGSC":
            kgsc, pos = parse_anim_track(chunk, pos, 3)
        else:
            break
    return MdxNode(name, obj_id, parent_id, flags, kgtr, kgrt, kgsc), end_off


def load_mdx_model(path: str) -> MdxModel:
    data = open(path, "rb").read()
    if data[:4] != b"MDLX":
        raise ValueError(f"Invalid MDX header in {path}")
    model = MdxModel()
    pos = 4
    while pos + 8 <= len(data):
        tag = data[pos : pos + 4].decode("latin1")
        sz = struct.unpack_from("<I", data, pos + 4)[0]
        chunk = data[pos + 8 : pos + 8 + sz]
        pos += 8 + sz

        if tag == "SEQS":
            for off in range(0, len(chunk), 132):
                name = chunk[off : off + 80].split(b"\x00", 1)[0].decode("latin1").strip()
                s_ms, e_ms, mspeed, flags = struct.unpack_from("<IIfI", chunk, off + 80)
                model.sequences.append(MdxSequence(name, s_ms, e_ms, bool(flags & 1), float(mspeed)))

        elif tag == "GLBS":
            cnt = len(chunk) // 4
            model.global_seqs = list(struct.unpack_from(f"<{cnt}I", chunk, 0))

        elif tag == "TEXS":
            for off in range(0, len(chunk), 268):
                rep_id = struct.unpack_from("<I", chunk, off)[0]
                fn = chunk[off + 4 : off + 264].split(b"\x00", 1)[0].decode("latin1")
                tflags = struct.unpack_from("<I", chunk, off + 264)[0]
                model.textures.append(MdxTexture(rep_id, fn, tflags))

        elif tag == "MTLS":
            off = 0
            while off < len(chunk):
                msz = struct.unpack_from("<I", chunk, off)[0]
                lcnt = struct.unpack_from("<I", chunk, off + 16)[0]
                loff = off + 20
                layers: List[MdxLayer] = []
                for _ in range(lcnt):
                    lsz, fmode, sflags, tid, taid, cid, lalpha = struct.unpack_from("<IIIIiIf", chunk, loff)
                    lend = loff + lsz
                    lpos = loff + 28
                    kmta = kmtf = None
                    while lpos < lend:
                        stag = chunk[lpos : lpos + 4].decode("latin1")
                        if stag == "KMTA":
                            kmta, lpos = parse_anim_track(chunk, lpos, 1)
                        elif stag == "KMTF":
                            # KMTF stores uint32 textureId; read as 1 uint32 converted to float
                            cnt, interp, glb = struct.unpack_from("<IIi", chunk, lpos + 4)
                            kpos = lpos + 16
                            ktimes = np.empty(cnt, dtype=np.int32)
                            kvals = np.empty((cnt, 1), dtype=np.float32)
                            for ki in range(cnt):
                                kt, kv = struct.unpack_from("<iI", chunk, kpos)
                                ktimes[ki] = kt
                                kvals[ki, 0] = float(kv)
                                kpos += 8 + (8 if interp > 1 else 0)
                            kmtf = AnimTrack("KMTF", 0, glb, ktimes, kvals)
                            lpos = kpos
                        else:
                            break
                    layers.append(MdxLayer(fmode, sflags, tid, taid, cid, lalpha, kmta, kmtf))
                    loff = lend
                model.materials.append(layers)
                off += msz

        elif tag == "TXAN":
            off = 0
            while off < len(chunk):
                tsz = struct.unpack_from("<I", chunk, off)[0]
                tend = off + tsz
                tpos = off + 4
                ktat = None
                while tpos < tend:
                    stag = chunk[tpos : tpos + 4].decode("latin1")
                    if stag == "KTAT":
                        ktat, tpos = parse_anim_track(chunk, tpos, 3)
                    elif stag == "KTAR":
                        _, tpos = parse_anim_track(chunk, tpos, 4)
                    elif stag == "KTAS":
                        _, tpos = parse_anim_track(chunk, tpos, 3)
                    else:
                        break
                model.tex_anims.append(MdxTexAnim(ktat))
                off = tend

        elif tag == "GEOS":
            off = 0
            while off < len(chunk):
                gsz = struct.unpack_from("<I", chunk, off)[0]
                gend = off + gsz
                p = off + 4
                assert chunk[p : p + 4] == b"VRTX"
                vcnt = struct.unpack_from("<I", chunk, p + 4)[0]
                verts = np.frombuffer(chunk, dtype=np.float32, count=vcnt * 3, offset=p + 8).reshape(vcnt, 3).copy()
                p += 8 + vcnt * 12

                assert chunk[p : p + 4] == b"NRMS"
                ncnt = struct.unpack_from("<I", chunk, p + 4)[0]
                norms = np.frombuffer(chunk, dtype=np.float32, count=ncnt * 3, offset=p + 8).reshape(ncnt, 3).copy()
                p += 8 + ncnt * 12

                assert chunk[p : p + 4] == b"PTYP"
                ptcnt = struct.unpack_from("<I", chunk, p + 4)[0]
                p += 8 + ptcnt * 4

                assert chunk[p : p + 4] == b"PCNT"
                pccnt = struct.unpack_from("<I", chunk, p + 4)[0]
                p += 8 + pccnt * 4

                assert chunk[p : p + 4] == b"PVTX"
                icnt = struct.unpack_from("<I", chunk, p + 4)[0]
                tris = np.frombuffer(chunk, dtype=np.uint16, count=icnt, offset=p + 8).astype(np.int32).reshape(-1, 3).copy()
                p += 8 + icnt * 2

                assert chunk[p : p + 4] == b"GNDX"
                gcnt = struct.unpack_from("<I", chunk, p + 4)[0]
                vgroups = np.frombuffer(chunk, dtype=np.uint8, count=gcnt, offset=p + 8).copy()
                p += 8 + gcnt

                assert chunk[p : p + 4] == b"MTGC"
                mgcnt = struct.unpack_from("<I", chunk, p + 4)[0]
                mgsizes = struct.unpack_from(f"<{mgcnt}I", chunk, p + 8)
                p += 8 + mgcnt * 4

                assert chunk[p : p + 4] == b"MATS"
                mcnt = struct.unpack_from("<I", chunk, p + 4)[0]
                mats_flat = struct.unpack_from(f"<{mcnt}I", chunk, p + 8)
                p += 8 + mcnt * 4

                mgroups: List[List[int]] = []
                mcursor = 0
                for s in mgsizes:
                    mgroups.append(list(mats_flat[mcursor : mcursor + s]))
                    mcursor += s

                mat_id, _sel_grp, _sel_flg = struct.unpack_from("<III", chunk, p)
                p += 12 + 28  # skip default extent
                anim_ext_cnt = struct.unpack_from("<I", chunk, p)[0]
                p += 4 + anim_ext_cnt * 28

                assert chunk[p : p + 4] == b"UVAS"
                uv_sets = struct.unpack_from("<I", chunk, p + 4)[0]
                p += 8
                uvs = np.zeros((vcnt, 2), dtype=np.float32)
                for uset in range(uv_sets):
                    assert chunk[p : p + 4] == b"UVBS"
                    uvcnt = struct.unpack_from("<I", chunk, p + 4)[0]
                    if uset == 0:
                        uvs = np.frombuffer(chunk, dtype=np.float32, count=uvcnt * 2, offset=p + 8).reshape(uvcnt, 2).copy()
                    p += 8 + uvcnt * 8

                model.geosets.append(MdxGeoset(verts, norms, tris, vgroups, mgroups, mat_id, uvs))
                off = gend

        elif tag == "GEOA":
            off = 0
            while off < len(chunk):
                asz, alpha, flags, cr, cg, cb, gid = struct.unpack_from("<IfI3fi", chunk, off)
                aend = off + asz
                apos = off + 28
                kgao = kgac = None
                while apos < aend:
                    stag = chunk[apos : apos + 4].decode("latin1")
                    if stag == "KGAO":
                        kgao, apos = parse_anim_track(chunk, apos, 1)
                    elif stag == "KGAC":
                        kgac, apos = parse_anim_track(chunk, apos, 3)
                    else:
                        break
                model.geoset_anims[gid] = MdxGeosetAnim(
                    gid, alpha, flags, np.array([cr, cg, cb], dtype=np.float32), kgao, kgac
                )
                off = aend

        elif tag == "BONE":
            off = 0
            while off < len(chunk):
                node, end_node = parse_node_header(chunk, off)
                model.nodes[node.object_id] = node
                off = end_node + 8  # geosetId (4) + geosetAnimId (4)

        elif tag == "HELP":
            off = 0
            while off < len(chunk):
                node, end_node = parse_node_header(chunk, off)
                model.nodes[node.object_id] = node
                off = end_node

        elif tag in ("ATCH", "LITE", "PREM", "PRE2", "RIBB"):
            off = 0
            while off < len(chunk):
                entry_sz = struct.unpack_from("<I", chunk, off)[0]
                node, _ = parse_node_header(chunk, off + 4)
                model.nodes[node.object_id] = node
                off += entry_sz

        elif tag == "PIVT":
            pcnt = len(chunk) // 12
            model.pivots = np.frombuffer(chunk, dtype=np.float32, count=pcnt * 3).reshape(pcnt, 3).copy()

    return model


# ============================================================================
# 3. Skeletal Hierarchy Transform & Supersampled Isometric Rasterizer
# ============================================================================

def quat_to_mat3(q: np.ndarray) -> np.ndarray:
    x, y, z, w = float(q[0]), float(q[1]), float(q[2]), float(q[3])
    n = math.sqrt(x * x + y * y + z * z + w * w)
    if n > 1e-8:
        x, y, z, w = x / n, y / n, z / n, w / n
    xx, yy, zz = x * x, y * y, z * z
    xy, xz, yz = x * y, x * z, y * z
    wx, wy, wz = w * x, w * y, w * z
    return np.array(
        [
            [1 - 2 * (yy + zz), 2 * (xy - wz), 2 * (xz + wy)],
            [2 * (xy + wz), 1 - 2 * (xx + zz), 2 * (yz - wx)],
            [2 * (xz - wy), 2 * (yz + wx), 1 - 2 * (xx + yy)],
        ],
        dtype=np.float32,
    )


def evaluate_node_matrices(
    model: MdxModel,
    t_ms: float,
    seq_range: Tuple[int, int],
) -> Dict[int, np.ndarray]:
    memo: Dict[int, np.ndarray] = {}
    zero3 = np.zeros(3, dtype=np.float32)
    one3 = np.ones(3, dtype=np.float32)
    id_q = np.array([0.0, 0.0, 0.0, 1.0], dtype=np.float32)

    def get_mat(oid: int) -> np.ndarray:
        if oid in memo:
            return memo[oid]
        node = model.nodes.get(oid)
        if node is None:
            m = np.eye(4, dtype=np.float32)
            memo[oid] = m
            return m

        pivot = model.pivots[oid] if oid < len(model.pivots) else zero3
        tr = eval_track(node.kgtr, t_ms, seq_range, model.global_seqs, zero3, is_quat=False)
        rot = eval_track(node.kgrt, t_ms, seq_range, model.global_seqs, id_q, is_quat=True)
        sc = eval_track(node.kgsc, t_ms, seq_range, model.global_seqs, one3, is_quat=False)

        r3 = quat_to_mat3(rot)
        rs = r3 * sc[None, :]  # scale columns

        local = np.eye(4, dtype=np.float32)
        local[:3, :3] = rs
        # Translate(pivot + tr) * RS * Translate(-pivot) => pos = pivot + tr - RS @ pivot
        local[:3, 3] = pivot + tr - rs @ pivot

        if node.parent_id >= 0 and node.parent_id != oid:
            parent_m = get_mat(node.parent_id)
            if node.flags & 0x7:
                p_clean = parent_m.copy()
                if node.flags & 0x1:  # DontInheritTranslation
                    p_clean[:3, 3] = 0.0
                if node.flags & 0x4:  # DontInheritRotation
                    lengths = np.linalg.norm(p_clean[:3, :3], axis=0)
                    p_clean[:3, :3] = np.diag(lengths)
                if node.flags & 0x2:  # DontInheritScaling
                    lengths = np.maximum(1e-6, np.linalg.norm(p_clean[:3, :3], axis=0))
                    p_clean[:3, :3] /= lengths[None, :]
                world = p_clean @ local
            else:
                world = parent_m @ local
        else:
            world = local

        memo[oid] = world
        return world

    for oid in model.nodes:
        get_mat(oid)
    return memo


SIN_PITCH = 0.5
COS_PITCH = math.sqrt(1.0 - SIN_PITCH * SIN_PITCH)
LIGHT_DIR = np.array([-0.42, -0.58, 0.70], dtype=np.float32)
LIGHT_DIR /= np.linalg.norm(LIGHT_DIR)


def project_wc3_to_d2_iso(
    pts_wc3: np.ndarray,
    norms_wc3: np.ndarray,
    dir_idx: int,
    total_dirs: int = 8,
    pitch_deg: float = 30.0,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    WC3 model space: +X = forward (facing direction), +Y = character's left, +Z = up.
    D2 screen directions (0..7 clockwise from South):
      dir=0 (South): faces viewer (+Y_d2), character's left (+Y_wc3) is viewer's RIGHT (+X_d2)!
      Wait: if character faces viewer (South), their RIGHT hand (-Y_wc3) is on viewer's LEFT (-X_d2),
      and their LEFT hand (+Y_wc3) is on viewer's RIGHT (+X_d2)!
      Check right-handedness: X_d2 = +Y_wc3, Y_d2 = +X_wc3, Z_d2 = +Z_wc3 (det = -1? Wait:
      cross(X_wc3, Y_wc3) = +Z_wc3; in D2 iso (+X right, +Y toward viewer/screen-down-front, +Z up),
      cross(+X_right, +Y_toward_viewer) = -Z! So X_right = +Y_wc3, Y_toward = +X_wc3 flips handedness
      UNLESS we check: facing viewer (+Y_toward = +X_wc3), viewer's right (+X_right) IS character's left (+Y_wc3)!
      Wait: in 3D right-handed coords where viewer looks from +Y_world toward -Y_world (+X_world right, +Z_world up):
      Facing viewer means character forward (+X_wc3) = +Y_world!
      Then by right-hand rule around +Z_world (+90 deg rotation from +X to +Y):
      +X_wc3 -> (0, +1, 0) (+Y_world, toward viewer)
      +Y_wc3 -> (-1, 0, 0) (-X_world, viewer's LEFT? WAIT:
      Hold up! Stand facing +X (East): your LEFT arm points North (+Y), your RIGHT arm points South (-Y).
      Now rotate yourself to face South (-Y_compass / toward viewer at bottom of screen):
      Your forward (+X_wc3) points toward viewer. Your LEFT arm (+Y_wc3) points EAST (viewer's RIGHT, +X_screen)!
      Why did +90 deg give (-1, 0)? Because toward viewer is SOUTH (-Y_compass), where screenX = +X_east,
      screen_toward_viewer = -Y_north! In that right-handed system (+X east, +Y north, +Z up):
      Rotate -90 deg around +Z so forward (+X_wc3) points South (-Y_north):
        x_east = +y_wc3 (character's left arm points East = viewer's RIGHT!)
        y_south = +x_wc3 (character's forward points South = toward viewer!)
      YES! Both geometry AND right-hand rule agree 100%: at dir=0 (South), wx = +y_wc3, wy_south = +x_wc3!
    """
    yaw = (dir_idx / total_dirs) * (2.0 * math.pi)
    c = math.cos(yaw)
    s = math.sin(yaw)

    x0 = pts_wc3[:, 1]
    y0 = pts_wc3[:, 0]
    z0 = pts_wc3[:, 2]

    # Clockwise D2 rotation (0=S, 1=SW, 2=W, 3=NW, 4=N, 5=NE, 6=E, 7=SE):
    # At dir=1 (SW), forward `(x0=0, y0=1)` should move toward screen-left (`wx < 0, wy > 0`):
    wx = x0 * c - y0 * s
    wy = x0 * s + y0 * c
    wz = z0

    rad = math.radians(pitch_deg)
    sp = math.sin(rad)
    cp = math.cos(rad)

    cam_x = wx
    cam_y = wy * sp - wz * cp
    cam_z = wy * cp + wz * sp

    nx0 = norms_wc3[:, 1]
    ny0 = norms_wc3[:, 0]
    nz0 = norms_wc3[:, 2]
    nwx = nx0 * c - ny0 * s
    nwy = nx0 * s + ny0 * c
    nwz = nz0
    ncam_x = nwx
    ncam_y = nwy * sp - nwz * cp
    ncam_z = nwy * cp + nwz * sp

    return (
        np.stack([cam_x, cam_y, cam_z], axis=-1),
        np.stack([ncam_x, ncam_y, ncam_z], axis=-1),
    )


def sample_texture_bilinear(tex: np.ndarray, u: np.ndarray, v: np.ndarray, wrap_u: bool = True, wrap_v: bool = True) -> np.ndarray:
    h, w, _ = tex.shape
    uu = np.mod(u, 1.0) if wrap_u else np.clip(u, 0.0, 1.0)
    vv = np.mod(v, 1.0) if wrap_v else np.clip(v, 0.0, 1.0)
    fx = uu * (w - 1)
    fy = vv * (h - 1)
    x0 = np.floor(fx).astype(np.int32)
    y0 = np.floor(fy).astype(np.int32)
    x1 = np.minimum(w - 1, x0 + 1)
    y1 = np.minimum(h - 1, y0 + 1)
    wx = (fx - x0)[:, None]
    wy = (fy - y0)[:, None]

    c00 = tex[y0, x0].astype(np.float32)
    c10 = tex[y0, x1].astype(np.float32)
    c01 = tex[y1, x0].astype(np.float32)
    c11 = tex[y1, x1].astype(np.float32)
    top = c00 * (1.0 - wx) + c10 * wx
    bot = c01 * (1.0 - wx) + c11 * wx
    return top * (1.0 - wy) + bot * wy


def render_mdx_frame(
    model: MdxModel,
    tex_cache: BlpTextureCache,
    t_ms: float,
    seq_range: Tuple[int, int],
    dir_idx: int,
    out_w: int,
    out_h: int,
    foot_x: int,
    foot_y: int,
    px_per_wc3_unit: float,
    ssaa: int = 2,
    total_dirs: int = 8,
    pitch_deg: float = 30.0,
    z_offset_wc3: float = 0.0,
    extra_orb_node_substr: Optional[str] = None,
    phylactery_strength: float = 0.0,
    phylactery_phase: float = 0.0,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Renders one `(diffuse_rgba, glow_rgba)` pair at `(out_w, out_h)` using `ssaa` supersampling.
    """
    W = out_w * ssaa
    H = out_h * ssaa
    FX = foot_x * ssaa
    FY = foot_y * ssaa
    scale = px_per_wc3_unit * ssaa

    color_buf = np.zeros((H, W, 3), dtype=np.float32)
    alpha_buf = np.zeros((H, W), dtype=np.float32)
    glow_buf = np.zeros((H, W, 3), dtype=np.float32)
    z_buf = np.full((H, W), -1e9, dtype=np.float32)

    node_mats = evaluate_node_matrices(model, t_ms, seq_range)
    one1 = np.ones(1, dtype=np.float32)
    zero3 = np.zeros(3, dtype=np.float32)

    # Pre-skin all visible geosets and collect render passes:
    # Pass 0 = Opaque/Transparent (filterMode 0, 1)
    # Pass 1 = Alpha Blend (filterMode 2)
    # Pass 2 = Additive / Emissive Glow (filterMode 3, 4)
    passes: List[Tuple[int, int, MdxGeoset, MdxLayer, np.ndarray, np.ndarray, float, np.ndarray, np.ndarray]] = []

    for g_idx, geo in enumerate(model.geosets):
        ga = model.geoset_anims.get(g_idx)
        g_alpha = 1.0
        g_color = np.ones(3, dtype=np.float32)
        if ga is not None:
            g_alpha = float(
                eval_track(
                    ga.kgao,
                    t_ms,
                    seq_range,
                    model.global_seqs,
                    np.array([ga.alpha], dtype=np.float32),
                )[0]
            )
            if ga.flags & 2:
                g_color = np.clip(ga.color, 0.0, 2.0)
            if ga.kgac is not None:
                g_color = np.clip(
                    eval_track(ga.kgac, t_ms, seq_range, model.global_seqs, g_color),
                    0.0,
                    2.0,
                )
        if g_alpha <= 0.02:
            continue

        # Skin vertices & normals by averaging across each vertex's matrix group
        group_mats = []
        for grp in geo.matrix_groups:
            if not grp:
                group_mats.append(np.eye(4, dtype=np.float32))
            elif len(grp) == 1:
                group_mats.append(node_mats.get(grp[0], np.eye(4, dtype=np.float32)))
            else:
                acc = np.zeros((4, 4), dtype=np.float32)
                for bid in grp:
                    acc += node_mats.get(bid, np.eye(4, dtype=np.float32))
                acc /= float(len(grp))
                group_mats.append(acc)
        group_mats_arr = np.stack(group_mats, axis=0)  # (G, 4, 4)
        v_mats = group_mats_arr[geo.vertex_groups]     # (V, 4, 4)

        v_homo = np.concatenate([geo.vertices, np.ones((len(geo.vertices), 1), dtype=np.float32)], axis=-1)
        skinned_xyz = np.einsum("vij,vj->vi", v_mats, v_homo)[:, :3]
        skinned_xyz[:, 2] += z_offset_wc3
        skinned_nrm = np.einsum("vij,vj->vi", v_mats[:, :3, :3], geo.normals)
        n_len = np.maximum(1e-6, np.linalg.norm(skinned_nrm, axis=-1, keepdims=True))
        skinned_nrm /= n_len

        cam_pts, cam_nrms = project_wc3_to_d2_iso(skinned_xyz, skinned_nrm, dir_idx, total_dirs, pitch_deg)

        layers = model.materials[geo.material_id] if geo.material_id < len(model.materials) else []
        for l_idx, layer in enumerate(layers):
            l_alpha = layer.alpha
            if layer.kmta is not None:
                l_alpha = float(
                    eval_track(
                        layer.kmta,
                        t_ms,
                        seq_range,
                        model.global_seqs,
                        np.array([layer.alpha], dtype=np.float32),
                    )[0]
                )
            eff_alpha = g_alpha * l_alpha
            if eff_alpha <= 0.02:
                continue

            uv_shift = zero3
            if 0 <= layer.tex_anim_id < len(model.tex_anims):
                ta = model.tex_anims[layer.tex_anim_id]
                if ta.ktat is not None:
                    uv_shift = eval_track(ta.ktat, t_ms, seq_range, model.global_seqs, zero3)

            pass_order = 0 if layer.filter_mode in (0, 1) else (1 if layer.filter_mode == 2 else 2)
            passes.append((pass_order, l_idx, geo, layer, cam_pts, cam_nrms, eff_alpha, g_color, uv_shift))

    passes.sort(key=lambda item: (item[0], item[1]))

    for pass_order, _l_idx, geo, layer, cam_pts, cam_nrms, eff_alpha, g_color, uv_shift in passes:
        if layer.filter_mode > 4:
            continue

        tid = layer.texture_id
        if layer.kmtf is not None:
            tid = int(round(float(eval_track(layer.kmtf, t_ms, seq_range, model.global_seqs, one1 * tid)[0])))
        if tid < 0 or tid >= len(model.textures):
            continue
        tex_meta = model.textures[tid]
        if tex_meta.replaceable_id in (1, 2):
            tex = tex_cache.get_replaceable(tex_meta.replaceable_id)
        elif tex_meta.file_name:
            tex = tex_cache.load(tex_meta.file_name)
        else:
            continue

        # Attenuate large flat RTS hero-glow ground decals slightly so they don't wash out
        if tex_meta.replaceable_id == 2 and pass_order == 2:
            eff_alpha *= 0.42

        unshaded = bool(layer.shading_flags & 1) or pass_order == 2
        two_sided = True  # WC3 models rely heavily on mirrored/two-sided strips on capes/chains/horns

        sx = FX + cam_pts[:, 0] * scale
        sy = FY + cam_pts[:, 1] * scale
        sz = cam_pts[:, 2] * scale

        uvs = geo.uvs + uv_shift[:2][None, :]

        # Per-vertex Lambertian lighting
        if unshaded:
            v_shade = np.ones(len(cam_pts), dtype=np.float32)
        else:
            ndotl = np.sum(cam_nrms * LIGHT_DIR[None, :], axis=-1)
            if two_sided:
                ndotl = np.abs(ndotl)
            else:
                ndotl = np.maximum(0.0, ndotl)
            v_shade = np.clip(0.56 + 0.58 * ndotl, 0.45, 1.22).astype(np.float32)

        for tri in geo.triangles:
            i0, i1, i2 = int(tri[0]), int(tri[1]), int(tri[2])
            x0, y0, z0 = float(sx[i0]), float(sy[i0]), float(sz[i0])
            x1, y1, z1 = float(sx[i1]), float(sy[i1]), float(sz[i1])
            x2, y2, z2 = float(sx[i2]), float(sy[i2]), float(sz[i2])

            area = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0)
            if abs(area) < 0.05:
                continue
            if not two_sided and area < 0:
                continue

            min_x = max(0, int(math.floor(min(x0, x1, x2))))
            max_x = min(W - 1, int(math.ceil(max(x0, x1, x2))))
            min_y = max(0, int(math.floor(min(y0, y1, y2))))
            max_y = min(H - 1, int(math.ceil(max(y0, y1, y2))))
            if min_x > max_x or min_y > max_y:
                continue

            xs = np.arange(min_x, max_x + 1, dtype=np.float32) + 0.5
            ys = np.arange(min_y, max_y + 1, dtype=np.float32) + 0.5
            gx, gy = np.meshgrid(xs, ys)

            inv_area = 1.0 / area
            w0 = ((x1 - gx) * (y2 - gy) - (y1 - gy) * (x2 - gx)) * inv_area
            w1 = ((x2 - gx) * (y0 - gy) - (y2 - gy) * (x0 - gx)) * inv_area
            w2 = 1.0 - w0 - w1

            inside = (w0 >= -1e-4) & (w1 >= -1e-4) & (w2 >= -1e-4)
            if not np.any(inside):
                continue

            py_idx, px_idx = np.nonzero(inside)
            bw0 = w0[py_idx, px_idx]
            bw1 = w1[py_idx, px_idx]
            bw2 = w2[py_idx, px_idx]

            pz = bw0 * z0 + bw1 * z1 + bw2 * z2
            abs_y = py_idx + min_y
            abs_x = px_idx + min_x

            cur_z = z_buf[abs_y, abs_x]
            z_bias = 0.35 if pass_order == 1 else (1.8 if pass_order == 2 else 0.0)
            depth_ok = pz >= (cur_z - z_bias)
            if not np.any(depth_ok):
                continue

            abs_y = abs_y[depth_ok]
            abs_x = abs_x[depth_ok]
            pz = pz[depth_ok]
            bw0 = bw0[depth_ok]
            bw1 = bw1[depth_ok]
            bw2 = bw2[depth_ok]

            pu = bw0 * uvs[i0, 0] + bw1 * uvs[i1, 0] + bw2 * uvs[i2, 0]
            pv = bw0 * uvs[i0, 1] + bw1 * uvs[i1, 1] + bw2 * uvs[i2, 1]
            rgba = sample_texture_bilinear(tex, pu, pv)

            shade = (bw0 * v_shade[i0] + bw1 * v_shade[i1] + bw2 * v_shade[i2])[:, None]
            rgb = rgba[:, :3] * shade * g_color[None, :]
            tex_a = (rgba[:, 3] / 255.0) * eff_alpha

            if layer.filter_mode == 0:  # Opaque
                z_buf[abs_y, abs_x] = pz
                color_buf[abs_y, abs_x] = np.clip(rgb, 0.0, 255.0)
                alpha_buf[abs_y, abs_x] = 1.0

            elif layer.filter_mode == 1:  # Transparent cutout
                keep = tex_a >= 0.65
                if np.any(keep):
                    ky = abs_y[keep]
                    kx = abs_x[keep]
                    z_buf[ky, kx] = pz[keep]
                    color_buf[ky, kx] = np.clip(rgb[keep], 0.0, 255.0)
                    alpha_buf[ky, kx] = 1.0

            elif layer.filter_mode == 2:  # Alpha Blend (e.g. unit skin over TeamColor!)
                keep = tex_a > 0.02
                if np.any(keep):
                    ky = abs_y[keep]
                    kx = abs_x[keep]
                    sa = tex_a[keep][:, None]
                    srgb = np.clip(rgb[keep], 0.0, 255.0)
                    dst_a = alpha_buf[ky, kx][:, None]
                    dst_rgb = color_buf[ky, kx]
                    out_a = sa[:, 0] + dst_a[:, 0] * (1.0 - sa[:, 0])
                    safe_out_a = np.maximum(1e-5, out_a)[:, None]
                    color_buf[ky, kx] = (srgb * sa + dst_rgb * dst_a * (1.0 - sa)) / safe_out_a
                    alpha_buf[ky, kx] = np.clip(out_a, 0.0, 1.0)
                    solid = tex_a[keep] >= 0.85
                    if np.any(solid):
                        z_buf[ky[solid], kx[solid]] = np.maximum(z_buf[ky[solid], kx[solid]], pz[keep][solid])

            elif layer.filter_mode in (3, 4):  # Additive / AddAlpha -> Emissive Glow Pass!
                weight = tex_a[:, None] if layer.filter_mode == 4 else (eff_alpha * np.ones((len(pz), 1), dtype=np.float32))
                add_rgb = rgb * weight
                glow_buf[abs_y, abs_x] = np.minimum(255.0, glow_buf[abs_y, abs_x] + add_rgb)

    # Optional neutral elemental orb attached to Necromancer's staff/hand node for 4-way S4 tinting
    if extra_orb_node_substr:
        target_oid = None
        for oid, nd in model.nodes.items():
            if extra_orb_node_substr.lower() in nd.name.lower():
                target_oid = oid
                break
        if target_oid is not None and target_oid in node_mats:
            m = node_mats[target_oid]
            piv = model.pivots[target_oid] if target_oid < len(model.pivots) else np.zeros(3, dtype=np.float32)
            world_pt = (m @ np.array([piv[0], piv[1], piv[2], 1.0], dtype=np.float32))[:3]
            world_pt[2] += z_offset_wc3 + 4.0
            c_pt, _ = project_wc3_to_d2_iso(
                world_pt[None, :],
                np.array([[0.0, 0.0, 1.0]], dtype=np.float32),
                dir_idx,
                total_dirs,
                pitch_deg,
            )
            ox = FX + float(c_pt[0, 0]) * scale
            oy = FY + float(c_pt[0, 1]) * scale
            oz = float(c_pt[0, 2]) * scale
            r_px = max(5.0, 10.2 * ssaa)
            core_r = max(1.8, 2.5 * ssaa)
            y0i = max(0, int(oy - r_px))
            y1i = min(H - 1, int(oy + r_px) + 1)
            x0i = max(0, int(ox - r_px))
            x1i = min(W - 1, int(ox + r_px) + 1)
            ys_o = np.arange(y0i, y1i + 1, dtype=np.float32)[:, None] + 0.5
            xs_o = np.arange(x0i, x1i + 1, dtype=np.float32)[None, :] + 0.5
            dist = np.hypot(xs_o - ox, ys_o - oy)
            vis = (dist <= r_px) & (oz >= z_buf[y0i : y1i + 1, x0i : x1i + 1] - r_px * 0.85)
            if np.any(vis):
                fall = np.where(vis, ((1.0 - np.minimum(1.0, dist / r_px)) ** 1.65) * 255.0, 0.0)
                sub_g = glow_buf[y0i : y1i + 1, x0i : x1i + 1]
                glow_buf[y0i : y1i + 1, x0i : x1i + 1] = np.maximum(sub_g, fall[:, :, None])
                core_mask = vis & (dist <= core_r)
                if np.any(core_mask):
                    sub_c = color_buf[y0i : y1i + 1, x0i : x1i + 1]
                    sub_a = alpha_buf[y0i : y1i + 1, x0i : x1i + 1]
                    sub_c[core_mask] = 245.0
                    sub_a[core_mask] = 1.0

    if phylactery_strength > 0.02:
        draw_phylactery_overlay(
            color_buf,
            alpha_buf,
            glow_buf,
            z_buf,
            FX,
            FY,
            scale,
            dir_idx,
            total_dirs,
            pitch_deg,
            phylactery_strength,
            phylactery_phase,
        )

    # Downsample SSAA premultiplied RGBA cleanly to (out_w, out_h)
    if ssaa > 1:
        premul = color_buf * alpha_buf[:, :, None]
        premul_2d = premul.reshape(out_h, ssaa, out_w, ssaa, 3).mean(axis=(1, 3))
        a_2d = alpha_buf.reshape(out_h, ssaa, out_w, ssaa).mean(axis=(1, 3))
        mask = a_2d > 0.08
        out_rgba = np.zeros((out_h, out_w, 4), dtype=np.uint8)
        out_rgba[mask, :3] = np.clip(premul_2d[mask] / a_2d[mask, None], 0.0, 255.0).astype(np.uint8)
        out_rgba[mask, 3] = np.clip(a_2d[mask] * 255.0, 0.0, 255.0).astype(np.uint8)

        glow_2d = glow_buf.reshape(out_h, ssaa, out_w, ssaa, 3).mean(axis=(1, 3))
        glow_max = np.max(glow_2d, axis=-1)
        out_glow = np.zeros((out_h, out_w, 4), dtype=np.uint8)
        gmask = glow_max > 3.0
        out_glow[gmask, :3] = np.clip(glow_2d[gmask], 0.0, 255.0).astype(np.uint8)
        out_glow[gmask, 3] = np.clip(glow_max[gmask], 0.0, 255.0).astype(np.uint8)
        return out_rgba, out_glow

    out_rgba = np.zeros((out_h, out_w, 4), dtype=np.uint8)
    mask = alpha_buf > 0.08
    out_rgba[mask, :3] = np.clip(color_buf[mask], 0.0, 255.0).astype(np.uint8)
    out_rgba[mask, 3] = np.clip(alpha_buf[mask] * 255.0, 0.0, 255.0).astype(np.uint8)

    glow_max = np.max(glow_buf, axis=-1)
    out_glow = np.zeros((out_h, out_w, 4), dtype=np.uint8)
    gmask = glow_max > 3.0
    out_glow[gmask, :3] = np.clip(glow_buf[gmask], 0.0, 255.0).astype(np.uint8)
    out_glow[gmask, 3] = np.clip(glow_max[gmask], 0.0, 255.0).astype(np.uint8)
    return out_rgba, out_glow


def find_sequence(model: MdxModel, candidates: List[str]) -> MdxSequence:
    lower_map = {s.name.lower(): s for s in model.sequences}
    for cand in candidates:
        c = cand.lower()
        if c in lower_map:
            return lower_map[c]
    for cand in candidates:
        c = cand.lower()
        for s in model.sequences:
            if s.name.lower().startswith(c) and "lumber" not in s.name.lower() and "alternate" not in s.name.lower():
                return s
    return model.sequences[0]


def draw_phylactery_overlay(
    color_buf: np.ndarray,
    alpha_buf: np.ndarray,
    glow_buf: np.ndarray,
    z_buf: np.ndarray,
    fx: float,
    fy: float,
    scale: float,
    dir_idx: int,
    total_dirs: int,
    pitch_deg: float,
    strength: float,
    phase: float,
) -> None:
    """
    Draws Kel'Thuzad's hovering Naxxramas Frost Phylactery crystal & golden cage
    during the second half of `HeroLich` `Death` (`dt` -> `dd` corpse frame), since
    WC3's `HeroLich.mdx` implodes its body geosets to `alpha=0` at the end of `Death`.
    """
    if strength <= 0.02:
        return
    H, W = alpha_buf.shape
    bob_z = 36.0 + 4.0 * math.sin(phase * math.pi * 4.0)
    s = 0.55 + 0.45 * strength

    # Build a crisp 3D octahedron crystal + golden upper/lower cage rings in WC3 coords
    r_xy = 11.5 * s
    r_z = 21.0 * s
    top = np.array([0.0, 0.0, bob_z + r_z], dtype=np.float32)
    bot = np.array([0.0, 0.0, bob_z - r_z], dtype=np.float32)
    ring = [
        np.array([r_xy, 0.0, bob_z], dtype=np.float32),
        np.array([0.0, r_xy, bob_z], dtype=np.float32),
        np.array([-r_xy, 0.0, bob_z], dtype=np.float32),
        np.array([0.0, -r_xy, bob_z], dtype=np.float32),
    ]
    facets = []
    for k in range(4):
        p_a = ring[k]
        p_b = ring[(k + 1) % 4]
        facets.append((top, p_a, p_b, np.array([115.0, 228.0, 255.0], dtype=np.float32), True))
        facets.append((bot, p_b, p_a, np.array([75.0, 185.0, 245.0], dtype=np.float32), True))
        # Gold ornate cage collar segments around upper & lower crystal waist
        g_hi_a = p_a * 0.72 + top * 0.28
        g_hi_b = p_b * 0.72 + top * 0.28
        g_hi_a2 = p_a * 0.52 + top * 0.48
        g_hi_b2 = p_b * 0.52 + top * 0.48
        gold = np.array([224.0, 182.0, 78.0], dtype=np.float32)
        facets.append((g_hi_a, g_hi_b, g_hi_b2, gold, False))
        facets.append((g_hi_a, g_hi_b2, g_hi_a2, gold, False))

    for p0, p1, p2, base_col, is_crystal in facets:
        pts_w = np.stack([p0, p1, p2], axis=0)
        n_raw = np.cross(p1 - p0, p2 - p0)
        n_norm = n_raw / max(1e-6, float(np.linalg.norm(n_raw)))
        nrms_w = np.repeat(n_norm[None, :], 3, axis=0)
        c_pts, c_nrms = project_wc3_to_d2_iso(pts_w, nrms_w, dir_idx, total_dirs, pitch_deg)
        sx = fx + c_pts[:, 0] * scale
        sy = fy + c_pts[:, 1] * scale
        sz = c_pts[:, 2] * scale

        area = (sx[1] - sx[0]) * (sy[2] - sy[0]) - (sy[1] - sy[0]) * (sx[2] - sx[0])
        if abs(area) < 0.05:
            continue
        ndotl = abs(float(np.dot(c_nrms[0], LIGHT_DIR)))
        shade = 0.62 + 0.55 * ndotl
        f_rgb = np.clip(base_col * shade, 0.0, 255.0)

        min_x = max(0, int(math.floor(float(np.min(sx)))))
        max_x = min(W - 1, int(math.ceil(float(np.max(sx)))))
        min_y = max(0, int(math.floor(float(np.min(sy)))))
        max_y = min(H - 1, int(math.ceil(float(np.max(sy)))))
        if min_x > max_x or min_y > max_y:
            continue

        xs = np.arange(min_x, max_x + 1, dtype=np.float32) + 0.5
        ys = np.arange(min_y, max_y + 1, dtype=np.float32) + 0.5
        gx, gy = np.meshgrid(xs, ys)
        inv_a = 1.0 / area
        w0 = ((sx[1] - gx) * (sy[2] - gy) - (sy[1] - gy) * (sx[2] - gx)) * inv_a
        w1 = ((sx[2] - gx) * (sy[0] - gy) - (sy[2] - gy) * (sx[0] - gx)) * inv_a
        w2 = 1.0 - w0 - w1
        inside = (w0 >= -1e-4) & (w1 >= -1e-4) & (w2 >= -1e-4)
        if not np.any(inside):
            continue
        py_i, px_i = np.nonzero(inside)
        pz = w0[py_i, px_i] * sz[0] + w1[py_i, px_i] * sz[1] + w2[py_i, px_i] * sz[2]
        ay = py_i + min_y
        ax = px_i + min_x
        keep = pz >= z_buf[ay, ax]
        if not np.any(keep):
            continue
        ay, ax, pz = ay[keep], ax[keep], pz[keep]
        z_buf[ay, ax] = pz
        color_buf[ay, ax] = f_rgb * strength + color_buf[ay, ax] * (1.0 - strength)
        alpha_buf[ay, ax] = np.maximum(alpha_buf[ay, ax], strength)
        if is_crystal:
            glow_buf[ay, ax] = np.maximum(
                glow_buf[ay, ax],
                np.array([75.0, 205.0, 255.0], dtype=np.float32) * (0.85 * strength),
            )

    # Soft frost aura around the hovering Phylactery
    c_mid, _ = project_wc3_to_d2_iso(
        np.array([[0.0, 0.0, bob_z]], dtype=np.float32),
        np.array([[0.0, 0.0, 1.0]], dtype=np.float32),
        dir_idx,
        total_dirs,
        pitch_deg,
    )
    cx = fx + float(c_mid[0, 0]) * scale
    cy = fy + float(c_mid[0, 1]) * scale
    rad_px = 28.0 * scale * s
    y0i = max(0, int(cy - rad_px))
    y1i = min(H - 1, int(cy + rad_px) + 1)
    x0i = max(0, int(cx - rad_px))
    x1i = min(W - 1, int(cx + rad_px) + 1)
    ys_o = np.arange(y0i, y1i + 1, dtype=np.float32)[:, None] + 0.5
    xs_o = np.arange(x0i, x1i + 1, dtype=np.float32)[None, :] + 0.5
    d = np.hypot(xs_o - cx, ys_o - cy)
    m = d <= rad_px
    if np.any(m):
        w = np.where(m, ((1.0 - np.minimum(1.0, d / rad_px)) ** 2.0) * strength, 0.0)
        halo = w[:, :, None] * np.array([70.0, 195.0, 255.0], dtype=np.float32)[None, None, :]
        glow_buf[y0i : y1i + 1, x0i : x1i + 1] = np.minimum(
            255.0, glow_buf[y0i : y1i + 1, x0i : x1i + 1] + halo
        )


def find_visible_death_end_ms(model: MdxModel, seq: MdxSequence) -> float:
    """
    Finds the last timestamp in `[start_ms, end_ms]` where ANY major diffuse geoset
    (`>= 60` vertices, `filter_mode` in `0, 1, 2`, excluding tiny decay gut piles)
    remains visible (`alpha >= 0.5`).
    - Lets `Infernal` play its full `geo[2]` meteor-boulder shatter onto the ground (`100%`).
    - Stops `FleshGolem` right before `KGAO` flips to `0.0` at the final frame (`~98%`).
    """
    major_gids = [
        gi
        for gi, g in enumerate(model.geosets)
        if len(g.vertices) >= 60
        and any(
            l.filter_mode in (0, 1, 2)
            and "gutz" not in model.textures[l.texture_id].file_name.lower()
            for l in (model.materials[g.material_id] if g.material_id < len(model.materials) else [])
        )
    ]
    if not major_gids:
        return float(seq.end_ms)

    last_vis = float(seq.start_ms)
    steps = 80
    for i in range(steps + 1):
        t = seq.start_ms + (seq.end_ms - seq.start_ms) * (i / steps)
        any_vis = False
        for gi in major_gids:
            ga = model.geoset_anims.get(gi)
            g_a = (
                float(
                    eval_track(
                        ga.kgao,
                        t,
                        (seq.start_ms, seq.end_ms),
                        model.global_seqs,
                        np.array([ga.alpha], dtype=np.float32),
                    )[0]
                )
                if (ga is not None and ga.kgao is not None)
                else (ga.alpha if ga is not None else 1.0)
            )
            if g_a < 0.5:
                continue
            for l in model.materials[model.geosets[gi].material_id]:
                if l.filter_mode not in (0, 1, 2):
                    continue
                l_a = (
                    float(
                        eval_track(
                            l.kmta,
                            t,
                            (seq.start_ms, seq.end_ms),
                            model.global_seqs,
                            np.array([l.alpha], dtype=np.float32),
                        )[0]
                    )
                    if l.kmta is not None
                    else l.alpha
                )
                if g_a * l_a >= 0.5:
                    any_vis = True
                    break
            if any_vis:
                break
        if any_vis:
            last_vis = float(t)
    return max(float(seq.start_ms) + 50.0, last_vis)


UNIT_SPECS = [
    {
        "key": "hero",
        "mdx": "units/undead/herolich/herolich.mdx",
        "btn": "replaceabletextures/commandbuttons/btnherolich.blp",
        "w": 176,
        "h": 192,
        "fx": 88,
        "fy": 140,
        "px_scale": 0.65,
        "z_off": 0.0,
        "extra_orb": None,
    },
    {
        "key": "necroskeleton",
        "mdx": "units/undead/ghoul/ghoul.mdx",
        "btn": "replaceabletextures/commandbuttons/btnghoul.blp",
        "w": 176,
        "h": 184,
        "fx": 88,
        "fy": 120,
        "px_scale": 0.88,
        "z_off": 0.0,
        "extra_orb": None,
    },
    {
        "key": "necromage",
        "mdx": "units/undead/necromancer/necromancer.mdx",
        "btn": "replaceabletextures/commandbuttons/btnnecromancer.blp",
        "w": 176,
        "h": 184,
        "fx": 88,
        "fy": 124,
        "px_scale": 0.66,
        "z_off": 0.0,
        "extra_orb": "blizparticle02",
    },
    {
        "key": "claygolem",
        "mdx": "units/creeps/rockgolem/rockgolem.mdx",
        "btn": "replaceabletextures/commandbuttons/btnrockgolem.blp",
        "w": 208,
        "h": 216,
        "fx": 104,
        "fy": 140,
        "px_scale": 0.57,
        "z_off": 0.0,
        "extra_orb": None,
    },
    {
        "key": "bloodgolem",
        "mdx": "units/undead/abomination/abomination.mdx",
        "btn": "replaceabletextures/commandbuttons/btnabomination.blp",
        "btn_crop": True,
        "w": 208,
        "h": 216,
        "fx": 104,
        "fy": 136,
        "px_scale": 0.53,
        "z_off": 0.0,
        "extra_orb": None,
    },
    {
        "key": "irongolem",
        "mdx": "units/other/fleshgolem/fleshgolem.mdx",
        "btn": "replaceabletextures/commandbuttons/btnfleshgolem.blp",
        "w": 204,
        "h": 204,
        "fx": 102,
        "fy": 134,
        "px_scale": 0.54,
        "z_off": 0.0,
        "extra_orb": None,
    },
    {
        "key": "firegolem",
        "mdx": "units/demon/infernal/infernal.mdx",
        "btn": "replaceabletextures/commandbuttons/btninfernal.blp",
        "w": 208,
        "h": 216,
        "fx": 104,
        "fy": 144,
        "px_scale": 0.51,
        "z_off": 0.0,
        "extra_orb": None,
    },
]


def build_portrait_from_btn(tex_cache: BlpTextureCache, btn_rel: str, size: Tuple[int, int] = (92, 82)) -> np.ndarray:
    raw = tex_cache.load(btn_rel)
    # Crop 4px outer silver CommandButton bezel -> pure 56x56 Blizzard painted icon
    inner = raw[4:60, 4:60, :3]
    im = Image.fromarray(inner, "RGB").resize(size, Image.Resampling.LANCZOS)
    out = np.zeros((size[1], size[0], 4), dtype=np.uint8)
    out[:, :, :3] = np.array(im, dtype=np.uint8)
    out[:, :, 3] = 255
    return out


def render_preview_contact_sheet(war3_root: str, out_png: str, death_end: bool = False) -> None:
    tex_cache = BlpTextureCache(war3_root, team_color_index=3)
    tile_w, tile_h = 276, 286
    sheet = Image.new("RGBA", (tile_w * len(UNIT_SPECS), tile_h), (24, 24, 32, 255))

    for idx, spec in enumerate(UNIT_SPECS):
        mdl = load_mdx_model(os.path.join(war3_root, spec["mdx"]))
        phy_str = 0.0
        if death_end:
            seq = find_sequence(mdl, ["Death"])
            t_eval = float(seq.end_ms) if spec["key"] == "hero" else find_visible_death_end_ms(mdl, seq)
            if spec["key"] == "hero":
                phy_str = 1.0
        else:
            seq = find_sequence(mdl, ["Stand - 1", "Stand"])
            t_eval = (seq.start_ms + seq.end_ms) * 0.5
        diff, glow = render_mdx_frame(
            mdl,
            tex_cache,
            t_eval,
            (seq.start_ms, seq.end_ms),
            dir_idx=0,
            out_w=spec["w"],
            out_h=spec["h"],
            foot_x=spec["fx"],
            foot_y=spec["fy"],
            px_per_wc3_unit=spec["px_scale"],
            ssaa=2,
            extra_orb_node_substr=None if death_end else spec["extra_orb"],
            phylactery_strength=phy_str,
            phylactery_phase=1.0,
        )
        tile = np.zeros((tile_h, tile_w, 4), dtype=np.uint8)
        tile[:, :, :3] = (24, 24, 32)
        tile[:, :, 3] = 255
        ox = (tile_w - spec["w"]) // 2
        oy = tile_h - spec["h"] - 6
        sub = tile[oy : oy + spec["h"], ox : ox + spec["w"], :3].astype(np.float32)
        da = diff[:, :, 3:4].astype(np.float32) / 255.0
        sub = diff[:, :, :3] * da + sub * (1.0 - da)
        # Tint Necromage's neutral white orb cyan in preview so we verify its placement visually!
        g_rgb = glow[:, :, :3].astype(np.float32)
        if spec["key"] == "necromage":
            g_rgb = g_rgb * np.array([0.42, 0.92, 1.0], dtype=np.float32)
        sub = np.minimum(255.0, sub + g_rgb)
        tile[oy : oy + spec["h"], ox : ox + spec["w"], :3] = sub.astype(np.uint8)

        # Paste 46x41 CommandButton portrait in top-left corner of each tile!
        port = build_portrait_from_btn(tex_cache, spec["btn"], (46, 41))
        tile[6:47, 6:52] = port

        sheet.paste(Image.fromarray(tile, "RGBA"), (idx * tile_w, 0))

    os.makedirs(os.path.dirname(out_png), exist_ok=True)
    sheet.save(out_png)
    print(f"Saved 7-unit WC3 MDX preview contact sheet -> {out_png}")


def _bake_single_clip_worker(task: Tuple[str, dict, Tuple[str, List[str], int, int, bool]]) -> Tuple[str, str, str, int, bool, List[List[Tuple[bytes, bytes]]]]:
    war3_root, spec, (c_key, seq_names, n_frames, speed, loop) = task
    tex_cache = BlpTextureCache(war3_root, team_color_index=3)
    mdl = load_mdx_model(os.path.join(war3_root, spec["mdx"]))
    seq = find_sequence(mdl, seq_names)
    has_native_birth = any(s.name.lower().startswith("birth") for s in mdl.sequences)
    sample_end_ms = (
        float(seq.end_ms)
        if (c_key == "dt" and spec["key"] == "hero")
        else (find_visible_death_end_ms(mdl, seq) if c_key == "dt" else float(seq.end_ms))
    )

    dir_blobs: List[List[Tuple[bytes, bytes]]] = []
    for d in range(8):
        f_blobs: List[Tuple[bytes, bytes]] = []
        for f in range(n_frames):
            phase = (f / n_frames) if loop else (f / max(1, n_frames - 1))
            t_ms = seq.start_ms + (sample_end_ms - seq.start_ms) * phase
            z_off = 0.0
            if c_key == "s1" and not has_native_birth:
                z_off = -(1.0 - phase) * 58.0
            orb = None if (c_key == "dt" and phase > 0.7) else spec["extra_orb"]
            phy_str = 0.0
            if c_key == "dt" and spec["key"] == "hero" and phase >= 0.42:
                phy_str = min(1.0, (phase - 0.42) / 0.45)
            diff, glow = render_mdx_frame(
                mdl,
                tex_cache,
                t_ms,
                (seq.start_ms, seq.end_ms),
                dir_idx=d,
                out_w=spec["w"],
                out_h=spec["h"],
                foot_x=spec["fx"],
                foot_y=spec["fy"],
                px_per_wc3_unit=spec["px_scale"],
                ssaa=2,
                z_offset_wc3=z_off,
                extra_orb_node_substr=orb,
                phylactery_strength=phy_str,
                phylactery_phase=phase,
            )
            f_blobs.append((diff.tobytes(), glow.tobytes()))
        dir_blobs.append(f_blobs)

    return spec["key"], c_key, seq.name, speed, loop, dir_blobs


def bake_binary_payload(war3_root: str, out_dir: str) -> None:
    """
    Bakes all 7 authentic WC3 MDX models (8 directions x all clips) + official BTN portraits
    in parallel across CPU cores into `<out_dir>/manifest.json` + `<out_dir>/frames.bin`
    for ultra-fast packing by `pack-skin.ts`.
    """
    os.makedirs(out_dir, exist_ok=True)
    tex_cache = BlpTextureCache(war3_root, team_color_index=3)

    hero_clips = [
        ("nu", ["Stand", "Stand - 1"], 8, 128, True),
        ("wl", ["Walk"], 8, 256, True),
        ("rn", ["Walk"], 8, 288, True),
        ("sc", ["Spell", "Stand Channel"], 12, 256, False),
        ("a1", ["Attack", "Attack - 1"], 10, 256, False),
        ("gh", ["Stand Ready", "Stand"], 6, 256, False),
        ("dt", ["Death"], 14, 176, False),
    ]
    minion_clips = [
        ("nu", ["Stand - 1", "Stand"], 6, 128, True),
        ("wl", ["Walk"], 8, 224, True),
        ("a1", ["Attack - 1", "Attack -1", "Attack", "Spell Attack"], 8, 256, False),
        ("s1", ["Birth", "Stand Ready", "Stand Channel", "Stand - 1", "Stand"], 8, 192, False),
        ("gh", ["Stand Hit", "Stand Ready", "Stand - 2", "Stand 2", "Stand"], 5, 256, False),
        ("dt", ["Death"], 10, 176, False),
    ]

    tasks: List[Tuple[str, dict, Tuple[str, List[str], int, int, bool]]] = []
    for spec in UNIT_SPECS:
        clip_defs = hero_clips if spec["key"] == "hero" else minion_clips
        for cdef in clip_defs:
            tasks.append((war3_root, spec, cdef))

    workers = min(len(tasks), max(1, (os.cpu_count() or 8) - 2))
    results_by_unit: Dict[str, Dict[str, Tuple[str, int, bool, List[List[Tuple[bytes, bytes]]]]]] = {
        spec["key"]: {} for spec in UNIT_SPECS
    }
    with ProcessPoolExecutor(max_workers=workers) as pool:
        for u_key, c_key, seq_name, speed, loop, dir_blobs in pool.map(_bake_single_clip_worker, tasks):
            results_by_unit[u_key][c_key] = (seq_name, speed, loop, dir_blobs)

    bin_path = os.path.join(out_dir, "frames.bin")
    meta_units = {}

    with open(bin_path, "wb") as bf:
        offset = 0

        def write_raw(raw: bytes) -> Tuple[int, int]:
            nonlocal offset
            start = offset
            bf.write(raw)
            offset += len(raw)
            return start, len(raw)

        # Preview image for hero (`128x128` from BTNHeroLich)
        hero_preview = build_portrait_from_btn(
            tex_cache, "replaceabletextures/commandbuttons/btnherolich.blp", (128, 128)
        )
        hp_off, hp_len = write_raw(hero_preview.tobytes())

        for spec in UNIT_SPECS:
            key = spec["key"]
            clip_defs = hero_clips if key == "hero" else minion_clips
            port_arr = build_portrait_from_btn(tex_cache, spec["btn"], (92, 82))
            p_off, p_len = write_raw(port_arr.tobytes())

            baked_clips = []
            for c_key, _seq_names, _n_frames, _speed, _loop in clip_defs:
                seq_name, speed, loop, dir_blobs = results_by_unit[key][c_key]
                dir_entries = []
                for f_blobs in dir_blobs:
                    f_entries = []
                    for d_bytes, g_bytes in f_blobs:
                        d_off, d_len = write_raw(d_bytes)
                        g_off, g_len = write_raw(g_bytes)
                        f_entries.append(
                            {
                                "dOff": d_off,
                                "dLen": d_len,
                                "gOff": g_off,
                                "gLen": g_len,
                            }
                        )
                    dir_entries.append(f_entries)
                baked_clips.append(
                    {
                        "key": c_key,
                        "seqName": seq_name,
                        "speed": speed,
                        "loop": loop,
                        "directions": dir_entries,
                    }
                )
            meta_units[key] = {
                "width": spec["w"],
                "height": spec["h"],
                "footX": spec["fx"],
                "footY": spec["fy"],
                "portrait": {"off": p_off, "len": p_len, "w": 92, "h": 82},
                "clips": baked_clips,
            }

    manifest_out = {
        "heroPreview": {"off": hp_off, "len": hp_len, "w": 128, "h": 128},
        "units": meta_units,
    }
    with open(os.path.join(out_dir, "manifest.json"), "w", encoding="utf-8") as mf:
        json.dump(manifest_out, mf)
    print(f"[bake_war3_mdx] Wrote {out_dir}/frames.bin ({offset / (1024 * 1024):.1f} MB) across {workers} workers")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--war3-dir",
        default=os.environ.get("WAR3_MPQ_DIR", os.path.join(os.path.expanduser("~"), "d2-data", "war3-mpq")),
    )
    ap.add_argument("--preview-png", default="")
    ap.add_argument("--preview-death-png", default="")
    ap.add_argument("--bake-dir", default="")
    args = ap.parse_args()

    if args.preview_png:
        render_preview_contact_sheet(args.war3_dir, args.preview_png, death_end=False)
    if args.preview_death_png:
        render_preview_contact_sheet(args.war3_dir, args.preview_death_png, death_end=True)
    if args.bake_dir:
        bake_binary_payload(args.war3_dir, args.bake_dir)


if __name__ == "__main__":
    main()

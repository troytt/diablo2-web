#!/usr/bin/env python3
"""
World of Warcraft 3.3.5 model parser (`tools/skin-baker/wow_m2.py`).

Reads `MD20` version 264 models with their `.skin` view and external `.anim` files: vertices,
bones with animation tracks, sub-meshes (geosets) with texture units, textures, attachments and
animation sequences.
"""
import struct
from typing import Callable, Dict, List, Optional, Tuple

import numpy as np


class M2Track:
    """Per-sequence key frames of one animated value."""

    def __init__(self, interpolation: int, global_seq: int, times: List[np.ndarray], values: List[np.ndarray]) -> None:
        self.interpolation = interpolation
        self.global_seq = global_seq
        self.times = times
        self.values = values

    def has_keys(self, seq: int) -> bool:
        return seq < len(self.times) and len(self.times[seq]) > 0


class M2Bone:
    def __init__(self) -> None:
        self.key_bone = -1
        self.flags = 0
        self.parent = -1
        self.pivot = np.zeros(3, dtype=np.float32)
        self.translation: M2Track
        self.rotation: M2Track
        self.scale: M2Track


class M2Sequence:
    def __init__(self) -> None:
        self.anim_id = 0
        self.sub_id = 0
        self.length_ms = 0
        self.move_speed = 0.0
        self.flags = 0
        self.alias_next = 0
        self.index = 0


class M2Submesh:
    def __init__(self) -> None:
        self.geoset_id = 0
        self.start_vertex = 0
        self.n_vertices = 0
        self.start_triangle = 0
        self.n_triangles = 0


class M2TexUnit:
    def __init__(self) -> None:
        self.submesh = 0
        self.layer = 0
        self.blend = 0
        self.render_flags = 0
        self.texture = 0
        self.priority = 0


class M2Texture:
    def __init__(self, tex_type: int, flags: int, filename: str) -> None:
        self.type = tex_type
        self.flags = flags
        self.filename = filename


class M2Attachment:
    def __init__(self, att_id: int, bone: int, position: np.ndarray) -> None:
        self.id = att_id
        self.bone = bone
        self.position = position


class M2Model:
    def __init__(self) -> None:
        self.name = ""
        self.global_sequences: List[int] = []
        self.sequences: List[M2Sequence] = []
        self.bones: List[M2Bone] = []
        self.positions = np.zeros((0, 3), dtype=np.float32)
        self.normals = np.zeros((0, 3), dtype=np.float32)
        self.uvs = np.zeros((0, 2), dtype=np.float32)
        self.bone_indices = np.zeros((0, 4), dtype=np.uint16)
        self.bone_weights = np.zeros((0, 4), dtype=np.float32)
        self.textures: List[M2Texture] = []
        self.attachments: List[M2Attachment] = []
        # From the .skin view:
        self.vertex_lookup = np.zeros(0, dtype=np.uint16)
        self.triangles = np.zeros(0, dtype=np.uint16)
        self.submeshes: List[M2Submesh] = []
        self.tex_units: List[M2TexUnit] = []

    def find_sequence(self, anim_id: int, sub_id: int = 0) -> Optional[M2Sequence]:
        for s in self.sequences:
            if s.anim_id == anim_id and s.sub_id == sub_id:
                return s
        return None

    def resolve_alias(self, seq: M2Sequence) -> M2Sequence:
        seen = 0
        while seq.flags & 0x40 and seen < 16:
            seq = self.sequences[seq.alias_next]
            seen += 1
        return seq

    def attachment(self, att_id: int) -> M2Attachment:
        for a in self.attachments:
            if a.id == att_id:
                return a
        raise KeyError(f"{self.name}: attachment {att_id} not found")


def _array(data: bytes, off: int) -> Tuple[int, int]:
    return struct.unpack_from("<II", data, off)


def _unpack_quat(raw: np.ndarray) -> np.ndarray:
    v = raw.astype(np.float32)
    return np.where(v < 0, (v + 32768.0) / 32767.0, (v - 32767.0) / 32767.0).astype(np.float32)


def parse_m2(data: bytes, skin: bytes, read_anim: Callable[[int, int], Optional[bytes]]) -> M2Model:
    """
    @param read_anim - `(anim_id, sub_id) -> bytes` loader for external `.anim` files.
    """
    if data[:4] != b"MD20":
        raise ValueError("not an M2 model")
    version = struct.unpack_from("<I", data, 4)[0]
    if version != 264:
        raise ValueError(f"unsupported M2 version {version} (expected 264)")
    m = M2Model()
    n, o = _array(data, 0x08)
    m.name = data[o:o + n].split(b"\0")[0].decode("latin-1")
    n, o = _array(data, 0x14)
    m.global_sequences = list(struct.unpack_from(f"<{n}I", data, o)) if n else []

    n, o = _array(data, 0x1C)
    for i in range(n):
        s = M2Sequence()
        (s.anim_id, s.sub_id, s.length_ms, s.move_speed, s.flags) = struct.unpack_from("<HHIfI", data, o + i * 64)
        s.alias_next = struct.unpack_from("<H", data, o + i * 64 + 62)[0]
        s.index = i
        m.sequences.append(s)

    anim_files: Dict[int, Optional[bytes]] = {}

    def source_for(seq_index: int) -> Optional[bytes]:
        seq = m.sequences[seq_index]
        if seq.flags & 0x20:
            return data
        if seq.flags & 0x40:
            return None
        if seq_index not in anim_files:
            anim_files[seq_index] = read_anim(seq.anim_id, seq.sub_id)
        return anim_files[seq_index]

    def read_track(off: int, dtype: str, comps: int, quat: bool) -> M2Track:
        interp, gseq = struct.unpack_from("<Hh", data, off)
        nt, ot = _array(data, off + 4)
        nv, ov = _array(data, off + 12)
        times: List[np.ndarray] = []
        values: List[np.ndarray] = []
        for si in range(nt):
            src = data if gseq >= 0 else source_for(si)
            kn, ko = _array(data, ot + si * 8)
            vn, vo = _array(data, ov + si * 8) if si < nv else (0, 0)
            if src is None or kn == 0 or vn != kn or ko + kn * 4 > len(src):
                times.append(np.zeros(0, dtype=np.float32))
                values.append(np.zeros((0, comps), dtype=np.float32))
                continue
            times.append(np.frombuffer(src, dtype="<u4", count=kn, offset=ko).astype(np.float32))
            raw = np.frombuffer(src, dtype=dtype, count=kn * comps, offset=vo).reshape(kn, comps)
            values.append(_unpack_quat(raw) if quat else raw.astype(np.float32))
        return M2Track(interp, gseq, times, values)

    n, o = _array(data, 0x2C)
    for i in range(n):
        b = M2Bone()
        base = o + i * 88
        b.key_bone, b.flags, b.parent = struct.unpack_from("<iIh", data, base)
        b.translation = read_track(base + 16, "<f4", 3, False)
        b.rotation = read_track(base + 36, "<i2", 4, True)
        b.scale = read_track(base + 56, "<f4", 3, False)
        b.pivot = np.frombuffer(data, dtype="<f4", count=3, offset=base + 76).copy()
        m.bones.append(b)

    n, o = _array(data, 0x3C)
    vert = np.frombuffer(data, dtype=np.dtype([
        ("pos", "<f4", 3), ("w", "u1", 4), ("b", "u1", 4), ("nrm", "<f4", 3), ("uv", "<f4", 2), ("uv2", "<f4", 2),
    ]), count=n, offset=o)
    m.positions = vert["pos"].copy()
    m.normals = vert["nrm"].copy()
    m.uvs = vert["uv"].copy()
    m.bone_indices = vert["b"].astype(np.uint16)
    m.bone_weights = vert["w"].astype(np.float32) / 255.0

    n, o = _array(data, 0x50)
    for i in range(n):
        t_type, t_flags = struct.unpack_from("<II", data, o + i * 16)
        fn, fo = _array(data, o + i * 16 + 8)
        m.textures.append(M2Texture(t_type, t_flags, data[fo:fo + fn].split(b"\0")[0].decode("latin-1")))

    n, o = _array(data, 0x70)
    render_flags = [struct.unpack_from("<HH", data, o + i * 4) for i in range(n)]
    n, o = _array(data, 0x80)
    tex_lookup = list(struct.unpack_from(f"<{n}h", data, o)) if n else []

    n, o = _array(data, 0xF0)
    for i in range(n):
        att_id, bone = struct.unpack_from("<IH", data, o + i * 40)
        pos = np.frombuffer(data, dtype="<f4", count=3, offset=o + i * 40 + 8).copy()
        m.attachments.append(M2Attachment(att_id, bone, pos))

    if skin[:4] != b"SKIN":
        raise ValueError("not a .skin view")
    n, o = _array(skin, 4)
    m.vertex_lookup = np.frombuffer(skin, dtype="<u2", count=n, offset=o).copy()
    n, o = _array(skin, 12)
    m.triangles = np.frombuffer(skin, dtype="<u2", count=n, offset=o).copy()
    n, o = _array(skin, 28)
    for i in range(n):
        sm = M2Submesh()
        gid, level, sm.start_vertex, sm.n_vertices, start_tri, sm.n_triangles = struct.unpack_from("<HHHHHH", skin, o + i * 48)
        sm.geoset_id = gid
        sm.start_triangle = start_tri + (level << 16)
        m.submeshes.append(sm)
    n, o = _array(skin, 36)
    for i in range(n):
        (flags, priority, _shader, submesh, _submesh2, _color, rf, layer, _ops, tex, _tu, _trans, _anim) = \
            struct.unpack_from("<BBHHHhHHHHHHH", skin, o + i * 24)
        tu = M2TexUnit()
        tu.submesh = submesh
        tu.layer = layer
        tu.priority = priority
        tu.render_flags, tu.blend = render_flags[rf] if rf < len(render_flags) else (0, 0)
        tu.texture = tex_lookup[tex] if tex < len(tex_lookup) else -1
        m.tex_units.append(tu)
    return m


def quat_to_mat3(q: np.ndarray) -> np.ndarray:
    x, y, z, w = [float(v) for v in q]
    return np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)],
        [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)],
        [2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)],
    ], dtype=np.float64)


def quat_slerp(a: np.ndarray, b: np.ndarray, u: float) -> np.ndarray:
    a = a.astype(np.float64)
    b = b.astype(np.float64)
    dot = float(np.dot(a, b))
    if dot < 0:
        b = -b
        dot = -dot
    if dot > 0.9995:
        out = a + (b - a) * u
    else:
        theta0 = np.arccos(min(1.0, dot))
        theta = theta0 * u
        out = a * (np.cos(theta) - dot * np.sin(theta) / np.sin(theta0)) + b * (np.sin(theta) / np.sin(theta0))
    n = np.linalg.norm(out)
    return (out / n if n > 1e-8 else np.array([0.0, 0.0, 0.0, 1.0])).astype(np.float32)


def sample_track(track: M2Track, seq: int, t_ms: float, default: np.ndarray, quat: bool,
                 global_time_ms: Optional[float], global_sequences: List[int]) -> np.ndarray:
    """Sample a track; tracks driven by a global sequence stay at `default` when `global_time_ms` is None."""
    if track.global_seq >= 0:
        if global_time_ms is None:
            return default
        seq = 0
        length = global_sequences[track.global_seq] if track.global_seq < len(global_sequences) else 0
        t_ms = (global_time_ms % length) if length > 0 else 0.0
    if not track.has_keys(seq):
        return default
    times, values = track.times[seq], track.values[seq]
    if t_ms <= times[0]:
        return values[0]
    if t_ms >= times[-1]:
        return values[-1]
    hi = int(np.searchsorted(times, t_ms, side="right"))
    lo = hi - 1
    if track.interpolation == 0 or times[hi] <= times[lo]:
        return values[lo]
    u = float((t_ms - times[lo]) / (times[hi] - times[lo]))
    if quat:
        return quat_slerp(values[lo], values[hi], u)
    return values[lo] + (values[hi] - values[lo]) * u


IDENTITY_T = np.zeros(3, dtype=np.float32)
IDENTITY_R = np.array([0, 0, 0, 1], dtype=np.float32)
IDENTITY_S = np.ones(3, dtype=np.float32)


def bone_local(m: M2Model, bone: M2Bone, seq: int, t_ms: float) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Sampled (translation, rotation xyzw, scale) of one bone. Tracks driven by a global sequence
    (free-running secondary motion) are left at rest so a clip is a pure function of its own time.
    """
    gs = m.global_sequences
    return (
        np.asarray(sample_track(bone.translation, seq, t_ms, IDENTITY_T, False, None, gs), dtype=np.float32),
        np.asarray(sample_track(bone.rotation, seq, t_ms, IDENTITY_R, True, None, gs), dtype=np.float32),
        np.asarray(sample_track(bone.scale, seq, t_ms, IDENTITY_S, False, None, gs), dtype=np.float32),
    )


def bone_matrices(m: M2Model, seq: int, t_ms: float) -> np.ndarray:
    """World skinning matrices (n, 4, 4): `parent * T(pivot) * T(t) * R * S * T(-pivot)`."""
    out = np.zeros((len(m.bones), 4, 4), dtype=np.float64)
    for i, bone in enumerate(m.bones):
        t, r, s = bone_local(m, bone, seq, t_ms)
        loc = np.eye(4)
        loc[:3, :3] = quat_to_mat3(r) * s.astype(np.float64)[None, :]
        piv = bone.pivot.astype(np.float64)
        loc[:3, 3] = piv + t.astype(np.float64) - loc[:3, :3] @ piv
        out[i] = out[bone.parent] @ loc if bone.parent >= 0 else loc
    return out

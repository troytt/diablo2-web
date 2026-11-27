#!/usr/bin/env python3
"""
BLP2 texture decoder for World of Warcraft 3.3.5 (`tools/skin-baker/wow_blp.py`).

Decodes the top mip level of palettized, DXT1/DXT3/DXT5 and raw BGRA textures to RGBA.
"""
import struct

import numpy as np


def _rgb565(c: np.ndarray) -> np.ndarray:
    r = ((c >> 11) & 0x1F).astype(np.uint16)
    g = ((c >> 5) & 0x3F).astype(np.uint16)
    b = (c & 0x1F).astype(np.uint16)
    return np.stack([(r * 255 + 15) // 31, (g * 255 + 31) // 63, (b * 255 + 15) // 31], axis=-1)


def _expand_blocks(values: np.ndarray, width: int, height: int) -> np.ndarray:
    """`values`: (blocks, 16, C) in row-major texel order -> (height, width, C)."""
    bw, bh = (width + 3) // 4, (height + 3) // 4
    c = values.shape[-1]
    img = values.reshape(bh, bw, 4, 4, c).transpose(0, 2, 1, 3, 4).reshape(bh * 4, bw * 4, c)
    return img[:height, :width]


def _color_block(data: np.ndarray, dxt1: bool) -> np.ndarray:
    """`data`: (blocks, 8) uint8 colour blocks -> (blocks, 16, 4) RGBA (alpha only meaningful for DXT1)."""
    c0 = data[:, 0].astype(np.uint16) | (data[:, 1].astype(np.uint16) << 8)
    c1 = data[:, 2].astype(np.uint16) | (data[:, 3].astype(np.uint16) << 8)
    bits = (data[:, 4].astype(np.uint32) | (data[:, 5].astype(np.uint32) << 8)
            | (data[:, 6].astype(np.uint32) << 16) | (data[:, 7].astype(np.uint32) << 24))
    p0, p1 = _rgb565(c0), _rgb565(c1)
    pal = np.zeros((len(data), 4, 4), dtype=np.uint16)
    pal[:, 0, :3], pal[:, 1, :3] = p0, p1
    pal[:, :, 3] = 255
    four = (c0 > c1) | (not dxt1)
    f = four[:, None]
    pal[:, 2, :3] = np.where(f, (2 * p0 + p1 + 1) // 3, (p0 + p1) // 2)
    pal[:, 3, :3] = np.where(f, (p0 + 2 * p1 + 1) // 3, 0)
    pal[:, 3, 3] = np.where(four, 255, 0)
    idx = (bits[:, None] >> (2 * np.arange(16, dtype=np.uint32))[None, :]) & 3
    return np.take_along_axis(pal, idx[:, :, None].astype(np.int64).repeat(4, axis=2), axis=1)


def _dxt5_alpha(data: np.ndarray) -> np.ndarray:
    a0 = data[:, 0].astype(np.uint16)
    a1 = data[:, 1].astype(np.uint16)
    bits = np.zeros(len(data), dtype=np.uint64)
    for i in range(6):
        bits |= data[:, 2 + i].astype(np.uint64) << np.uint64(8 * i)
    pal = np.zeros((len(data), 8), dtype=np.uint16)
    pal[:, 0], pal[:, 1] = a0, a1
    eight = a0 > a1
    for i in range(1, 7):
        pal[:, 1 + i] = np.where(eight, ((7 - i) * a0 + i * a1) // 7, 0)
    for i in range(1, 5):
        pal[:, 1 + i] = np.where(eight, pal[:, 1 + i], ((5 - i) * a0 + i * a1) // 5)
    pal[:, 6] = np.where(eight, pal[:, 6], 0)
    pal[:, 7] = np.where(eight, pal[:, 7], 255)
    idx = ((bits[:, None] >> (np.uint64(3) * np.arange(16, dtype=np.uint64))[None, :]) & np.uint64(7)).astype(np.int64)
    return np.take_along_axis(pal, idx, axis=1)


def decode_blp(data: bytes) -> np.ndarray:
    """Decode a BLP2 file to an RGBA `uint8` array of shape (height, width, 4)."""
    if data[:4] != b"BLP2":
        raise ValueError("not a BLP2 texture")
    _type, encoding, alpha_depth, alpha_encoding, _mips, width, height = struct.unpack_from("<IBBBBII", data, 4)
    offset = struct.unpack_from("<I", data, 20)[0]
    size = struct.unpack_from("<I", data, 84)[0]
    body = np.frombuffer(data, dtype=np.uint8, count=size, offset=offset)
    out = np.zeros((height, width, 4), dtype=np.uint8)
    if encoding == 1:
        pal = np.frombuffer(data, dtype=np.uint8, count=1024, offset=148).reshape(256, 4)
        n = width * height
        out[:, :, :3] = pal[body[:n]][:, [2, 1, 0]].reshape(height, width, 3)
        if alpha_depth == 8:
            out[:, :, 3] = body[n:2 * n].reshape(height, width)
        elif alpha_depth == 1:
            out[:, :, 3] = np.unpackbits(body[n:n + (n + 7) // 8], bitorder="little")[:n].reshape(height, width) * 255
        elif alpha_depth == 4:
            nib = body[n:n + (n + 1) // 2]
            a = np.stack([nib & 0xF, nib >> 4], axis=1).reshape(-1)[:n]
            out[:, :, 3] = (a * 17).reshape(height, width)
        else:
            out[:, :, 3] = 255
        return out
    if encoding == 3:
        out[:] = body[:width * height * 4].reshape(height, width, 4)[:, :, [2, 1, 0, 3]]
        return out
    if encoding != 2:
        raise ValueError(f"unsupported BLP2 encoding {encoding}")
    blocks = ((width + 3) // 4) * ((height + 3) // 4)
    if alpha_depth <= 1 and alpha_encoding == 0:
        rgba = _color_block(body[:blocks * 8].reshape(blocks, 8), True)
        if alpha_depth == 0:
            rgba[:, :, 3] = 255
        return _expand_blocks(rgba, width, height).astype(np.uint8)
    raw = body[:blocks * 16].reshape(blocks, 16)
    rgba = _color_block(raw[:, 8:], False)
    if alpha_encoding == 7:
        rgba[:, :, 3] = _dxt5_alpha(raw[:, :8])
    else:  # DXT3: explicit 4-bit alpha
        nib = raw[:, :8]
        rgba[:, :, 3] = np.stack([nib & 0xF, nib >> 4], axis=2).reshape(blocks, 16).astype(np.uint16) * 17
    return _expand_blocks(rgba, width, height).astype(np.uint8)

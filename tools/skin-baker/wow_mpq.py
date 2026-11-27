#!/usr/bin/env python3
"""
Minimal MPQ v1/v2 reader for World of Warcraft 3.3.5 archives (`tools/skin-baker/wow_mpq.py`).

Supports the hash/block tables (including the 64-bit offsets of v2 archives), encrypted members,
sector and single-unit storage, and zlib / bzip2 compression. `WowData` resolves a file through
the client's patch chain (newest archive first).
"""
import os
import bz2
import struct
import sys
import zlib


def _crypt_table():
    t = [0] * 0x500
    seed = 0x00100001
    for i in range(0x100):
        idx = i
        for _ in range(5):
            seed = (seed * 125 + 3) % 0x2AAAAB
            a = (seed & 0xFFFF) << 16
            seed = (seed * 125 + 3) % 0x2AAAAB
            t[idx] = a | (seed & 0xFFFF)
            idx += 0x100
    return t


CT = _crypt_table()


def hash_string(s, htype):
    s1, s2 = 0x7FED7FED, 0xEEEEEEEE
    for ch in s.upper().replace('/', '\\').encode('latin-1'):
        s1 = (CT[(htype << 8) + ch] ^ (s1 + s2)) & 0xFFFFFFFF
        s2 = (ch + s1 + s2 + (s2 << 5) + 3) & 0xFFFFFFFF
    return s1


def decrypt(data, key):
    n = len(data) // 4
    vals = list(struct.unpack('<%dI' % n, data[:n * 4]))
    seed = 0xEEEEEEEE
    for i in range(n):
        seed = (seed + CT[0x400 + (key & 0xFF)]) & 0xFFFFFFFF
        v = vals[i] ^ ((key + seed) & 0xFFFFFFFF)
        key = (((~key << 0x15) + 0x11111111) | (key >> 0x0B)) & 0xFFFFFFFF
        seed = (v + seed + (seed << 5) + 3) & 0xFFFFFFFF
        vals[i] = v
    return struct.pack('<%dI' % n, *vals) + data[n * 4:]


def _decomp(buf, out_size):
    if len(buf) >= out_size:
        return buf
    mask, body = buf[0], buf[1:]
    if mask == 0x02:
        return zlib.decompress(body)
    if mask == 0x10:
        return bz2.decompress(body)
    raise ValueError('unsupported compression mask 0x%02x' % mask)


class Mpq:
    def __init__(self, path):
        self.path = path
        self.f = open(path, 'rb')
        hdr = self.f.read(44)
        magic, hsize, asize, ver, shift, hto, bto, hte, bte = struct.unpack('<4sIIHHIIII', hdr[:32])
        assert magic == b'MPQ\x1a', magic
        self.sector = 512 << shift
        hi_bt, hto_hi, bto_hi = 0, 0, 0
        if ver >= 1:
            hi_bt, hto_hi, bto_hi = struct.unpack('<QHH', hdr[32:44])
        hto |= hto_hi << 32
        bto |= bto_hi << 32
        self.f.seek(hto)
        ht = decrypt(self.f.read(hte * 16), hash_string('(hash table)', 3))
        self.f.seek(bto)
        bt = decrypt(self.f.read(bte * 16), hash_string('(block table)', 3))
        hi = [0] * bte
        if hi_bt:
            self.f.seek(hi_bt)
            hi = list(struct.unpack('<%dH' % bte, self.f.read(bte * 2)))
        self.hash = [struct.unpack_from('<IIHHI', ht, i * 16) for i in range(hte)]
        self.block = [struct.unpack_from('<IIII', bt, i * 16) for i in range(bte)]
        self.block = [(o | (hi[i] << 32), c, s, fl) for i, (o, c, s, fl) in enumerate(self.block)]
        self.index = {}
        for a, b, _loc, _plat, bi in self.hash:
            if bi < bte:
                self.index.setdefault((a, b), bi)

    def find(self, name):
        return self.index.get((hash_string(name, 1), hash_string(name, 2)))

    def has(self, name):
        bi = self.find(name)
        return bi is not None and bool(self.block[bi][3] & 0x80000000) and not (self.block[bi][3] & 0x02000000)

    def read(self, name):
        bi = self.find(name)
        if bi is None:
            return None
        off, csize, size, flags = self.block[bi]
        if not flags & 0x80000000 or flags & 0x02000000:
            return None
        key = None
        if flags & 0x00010000:
            key = hash_string(name.replace('/', '\\').split('\\')[-1], 3)
            if flags & 0x00020000:
                key = ((key + (off & 0xFFFFFFFF)) ^ size) & 0xFFFFFFFF
        self.f.seek(off)
        if flags & 0x01000000:  # single unit
            buf = self.f.read(csize)
            if key is not None:
                buf = decrypt(buf, key)
            return _decomp(buf, size) if flags & 0x200 else buf
        if not flags & 0x300:
            buf = self.f.read(size)
            if key is None:
                return buf
            out = b''
            for i in range(0, size, self.sector):
                out += decrypt(buf[i:i + self.sector], (key + i // self.sector) & 0xFFFFFFFF)
            return out
        nsec = (size + self.sector - 1) // self.sector
        ntab = nsec + 1 + (1 if flags & 0x04000000 else 0)
        tab = self.f.read(ntab * 4)
        if key is not None:
            tab = decrypt(tab, (key - 1) & 0xFFFFFFFF)
        offs = struct.unpack('<%dI' % ntab, tab)
        out = []
        left = size
        for i in range(nsec):
            self.f.seek(off + offs[i])
            buf = self.f.read(offs[i + 1] - offs[i])
            if key is not None:
                buf = decrypt(buf, (key + i) & 0xFFFFFFFF)
            want = min(self.sector, left)
            out.append(_decomp(buf, want))
            left -= want
        return b''.join(out)

    def listfile(self):
        data = self.read('(listfile)')
        return [] if data is None else [x for x in data.decode('latin-1').replace('\r', '').split('\n') if x]


# Newest first: a file in a later patch archive overrides the base archives.
PATCH_CHAIN = ["patch-3", "patch-2", "patch", "lichking", "expansion", "common-2", "common"]


LOCALE_CHAIN = ["patch-%s-3", "patch-%s-2", "patch-%s", "lichking-locale-%s", "expansion-locale-%s", "locale-%s"]


class WowData:
    """Read files from an extracted 3.3.5 `Data` directory through the patch chain."""

    def __init__(self, root):
        data_dir = os.path.join(root, "Data") if os.path.isdir(os.path.join(root, "Data")) else root
        self.archives = []
        for name in PATCH_CHAIN:
            path = os.path.join(data_dir, name + ".MPQ")
            if os.path.exists(path):
                self.archives.append(Mpq(path))
        # Locale archives (client database tables live there); file names never clash with the base chain.
        for locale in sorted(os.listdir(data_dir)) if self.archives else []:
            locale_dir = os.path.join(data_dir, locale)
            if not os.path.isfile(os.path.join(locale_dir, "locale-%s.MPQ" % locale)):
                continue
            for name in LOCALE_CHAIN:
                path = os.path.join(locale_dir, name % locale + ".MPQ")
                if os.path.exists(path):
                    self.archives.append(Mpq(path))
        if not self.archives:
            raise SystemExit(
                "World of Warcraft 3.3.5 archives not found in %r. Set WOW_335_DIR to a directory "
                "containing Data/common.MPQ and the other base archives." % root)

    def has(self, name):
        return any(a.has(name) for a in self.archives)

    def read(self, name):
        for a in self.archives:
            if a.has(name):
                return a.read(name)
        raise FileNotFoundError(name)


if __name__ == '__main__':
    m = Mpq(sys.argv[1])
    if len(sys.argv) == 2:
        for n in m.listfile():
            print(n)
    else:
        sys.stdout.buffer.write(m.read(sys.argv[2]))

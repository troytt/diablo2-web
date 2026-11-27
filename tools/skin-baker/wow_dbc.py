#!/usr/bin/env python3
"""
World of Warcraft 3.3.5 client database (`WDBC`) reader (`tools/skin-baker/wow_dbc.py`).

Every field of a record is 4 bytes; string fields hold an offset into the string block.
"""
import struct
from typing import Callable, List, Tuple


def parse_dbc(data: bytes) -> Tuple[List[Tuple[int, ...]], Callable[[int], str]]:
    """Return (records as tuples of unsigned 32-bit fields, string lookup by offset)."""
    if data[:4] != b"WDBC":
        raise ValueError("not a WDBC table")
    records, fields, record_size, string_size = struct.unpack_from("<4I", data, 4)
    if record_size != fields * 4 or len(data) != 20 + records * record_size + string_size:
        raise ValueError("unsupported or truncated WDBC table")
    strings = data[20 + records * record_size:]
    rows = [struct.unpack_from("<%dI" % fields, data, 20 + i * record_size) for i in range(records)]

    def text(offset: int) -> str:
        return strings[offset:strings.index(b"\0", offset)].decode("latin-1")

    return rows, text

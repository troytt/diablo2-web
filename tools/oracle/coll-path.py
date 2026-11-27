#!/usr/bin/env python3
"""Analyse an oracle collision dump (coll_<frame>.bin from `dumpcoll`).

Usage: coll-path.py coll.bin START_X START_Y [--to-level L] [--png out.png]
          [--step N] [--mask 0x1C09]
Finds the shortest 8-connected walkable path from START to the nearest
subtile whose level id is L (default: any level different from START's) and
prints RunToLocation (0x03) waypoints every --step subtiles as scenario JSON
inputs. A cell is walkable when (mask & --mask) == 0 and it belongs to a room.
"""
import argparse
import collections
import json
import struct

ap = argparse.ArgumentParser()
ap.add_argument('bin')
ap.add_argument('sx', type=int)
ap.add_argument('sy', type=int)
ap.add_argument('--to-level', type=int)
ap.add_argument('--png')
ap.add_argument('--step', type=int, default=12)
ap.add_argument('--mask', type=lambda v: int(v, 0), default=0x1C09)
ap.add_argument('--start-frame', type=int, default=40)
ap.add_argument('--period', type=int, default=25)
a = ap.parse_args()

raw = open(a.bin, 'rb').read()
x0, y0, W, H = struct.unpack_from('<4i', raw, 0)
n = W * H
mask = struct.unpack_from(f'<{n}H', raw, 16)
lvl = struct.unpack_from(f'<{n}h', raw, 16 + 2 * n)


def idx(x, y):
  return (y - y0) * W + (x - x0)


def walk(i):
  return mask[i] != 0xFFFF and (mask[i] & a.mask) == 0


start = idx(a.sx, a.sy)
start_lvl = lvl[start]
levels = collections.Counter(l for l in lvl if l >= 0)
print('origin', x0, y0, 'size', W, H, 'start level', start_lvl, 'levels', dict(levels))

prev = {start: None}
q = collections.deque([start])
goal = None
while q:
  c = q.popleft()
  if lvl[c] >= 0 and ((a.to_level is not None and lvl[c] == a.to_level) or
                      (a.to_level is None and lvl[c] != start_lvl)):
    goal = c
    break
  cx, cy = c % W, c // W
  for dx in (-1, 0, 1):
    for dy in (-1, 0, 1):
      if not dx and not dy:
        continue
      nx, ny = cx + dx, cy + dy
      if not (0 <= nx < W and 0 <= ny < H):
        continue
      nc = ny * W + nx
      if nc in prev or not walk(nc):
        continue
      if dx and dy and not (walk(cy * W + nx) and walk(ny * W + cx)):
        continue  # no corner cutting
      prev[nc] = c
      q.append(nc)

if a.png:
  from PIL import Image
  img = Image.new('RGB', (W, H))
  px = img.load()
  for i in range(n):
    x, y = i % W, i // W
    if mask[i] == 0xFFFF:
      px[x, y] = (0, 0, 0)
    elif walk(i):
      px[x, y] = (40 + (lvl[i] * 37) % 200, 120, 40) if lvl[i] != start_lvl else (90, 90, 90)
    else:
      px[x, y] = (200, 60, 60)
  c = goal
  while c is not None:
    px[c % W, c // W] = (255, 255, 0)
    c = prev[c]
  img.save(a.png)

if goal is None:
  print('no path found (reached', len(prev), 'cells)')
  raise SystemExit(1)

path = []
c = goal
while c is not None:
  path.append((x0 + c % W, y0 + c // W))
  c = prev[c]
path.reverse()
print('path length', len(path), 'goal', path[-1], 'level', lvl[goal])
wps = path[a.step::a.step] + [path[-1]]
inputs = []
for k, (x, y) in enumerate(wps):
  inputs.append({'frame': a.start_frame + k * a.period,
                 'c2s': '03' + struct.pack('<HH', x, y).hex(),
                 'note': f'RunToLocation ({x},{y})'})
print(json.dumps(inputs))

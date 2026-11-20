#!/usr/bin/env python3
"""Host-side front-end menu driver for the oracle (XTEST fake input on Xvfb).

D2Win reads real pointer state, so window messages posted from inside the
process are ignored; XTEST events go through Wine's X11 driver like a real
mouse/keyboard.

Script format (one op per line, '#' comments), coordinates are client
coordinates inside the 800x600 "Diablo II" window:
  wait <ms>
  move <x> <y>
  click <x> <y>
  dclick <x> <y>
  key <keysym-name>        e.g. Return, Escape
  text <ascii>
  done                     touch <done-file>

Usage: menu-driver.py <script> <done-file>
Requires DISPLAY to point at the Xvfb server running the game.
"""
import sys
import time

from Xlib import X, XK, display
from Xlib.ext import xtest


def find_window(d, name):
  def walk(w):
    try:
      n = w.get_wm_name()
    except Exception:
      n = None
    if n == name:
      geo = w.get_geometry()
      if geo.width >= 640:
        return w
    try:
      children = w.query_tree().children
    except Exception:
      return None
    for c in children:
      r = walk(c)
      if r:
        return r
    return None
  return walk(d.screen().root)


def origin(d, w):
  """Root coordinates of the window's client origin."""
  x = y = 0
  cur = w
  while True:
    g = cur.get_geometry()
    x += g.x + g.border_width
    y += g.y + g.border_width
    parent = cur.query_tree().parent
    if not parent or parent.id == d.screen().root.id:
      break
    cur = parent
  return x, y


def main():
  script, done_file = sys.argv[1], sys.argv[2]
  d = display.Display()
  w = None
  for _ in range(600):
    w = find_window(d, 'Diablo II')
    if w:
      break
    time.sleep(0.1)
  if not w:
    print('window not found', flush=True)
    return 1
  ox, oy = origin(d, w)
  g = w.get_geometry()
  print(f'window origin {ox},{oy} size {g.width}x{g.height}', flush=True)

  def move(x, y):
    # The window starts at 640x480 and is resized/re-centred by D2 later,
    # so resolve the origin on every move.
    cur = find_window(d, 'Diablo II') or w
    cx, cy = origin(d, cur)
    xtest.fake_input(d, X.MotionNotify, x=cx + x, y=cy + y)
    d.sync()

  def focus():
    cur = find_window(d, 'Diablo II') or w
    cur.raise_window()
    cur.set_input_focus(X.RevertToParent, X.CurrentTime)
    d.sync()

  focus()

  def button(down):
    xtest.fake_input(d, X.ButtonPress if down else X.ButtonRelease, 1)
    d.sync()

  hold = 0.25

  def click(x, y):
    focus()
    move(x, y)
    time.sleep(0.15)
    button(True)
    time.sleep(hold)
    button(False)

  def key(sym_name):
    code = d.keysym_to_keycode(XK.string_to_keysym(sym_name))
    xtest.fake_input(d, X.KeyPress, code)
    d.sync()
    time.sleep(0.05)
    xtest.fake_input(d, X.KeyRelease, code)
    d.sync()

  def text(s):
    for ch in s:
      sym = XK.string_to_keysym(ch) or ord(ch)
      code = d.keysym_to_keycode(sym)
      shift = ch.isupper()
      if shift:
        xtest.fake_input(d, X.KeyPress, d.keysym_to_keycode(XK.XK_Shift_L))
      xtest.fake_input(d, X.KeyPress, code)
      xtest.fake_input(d, X.KeyRelease, code)
      if shift:
        xtest.fake_input(d, X.KeyRelease, d.keysym_to_keycode(XK.XK_Shift_L))
      d.sync()
      time.sleep(0.08)

  for raw in open(script):
    line = raw.split('#', 1)[0].strip()
    if not line:
      continue
    op, *a = line.split()
    if op == 'wait':
      time.sleep(int(a[0]) / 1000)
    elif op == 'move':
      move(int(a[0]), int(a[1]))
    elif op == 'click':
      click(int(a[0]), int(a[1]))
    elif op == 'dclick':
      click(int(a[0]), int(a[1]))
      time.sleep(0.1)
      click(int(a[0]), int(a[1]))
    elif op == 'key':
      key(a[0])
    elif op == 'text':
      text(a[0])
    elif op == 'done':
      open(done_file, 'w').close()
    print('menu:', line, flush=True)
  return 0


if __name__ == '__main__':
  sys.exit(main())

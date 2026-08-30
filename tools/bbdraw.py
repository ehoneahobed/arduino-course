"""
Breadboard + Arduino diagram generator for the Arduino Ladder.

The point of this file: a wiring picture is generated from the SAME hole
names the page's text uses, so the picture and the words cannot disagree.

It refuses to draw a board that has any of the three faults that have cost
this project the most:
  1. two legs in one hole              -> HOLE COLLISION
  2. a rail that nothing feeds         -> DEAD RAIL
  3. a rail fed from the wrong half    -> the top and bottom rail pairs are
                                          separate, so feeding -bot does not
                                          light anything wired to -top

Coordinates: column 1..N left to right, rows j i h g f | channel | e d c b a.
A hole is named like "f5" or "j20". Rails are "+top" "-top" "+bot" "-bot".
Arduino sockets are named "5V", "GND", "VIN", "3V3", "A0".."A5", "0".."13".
"""
import re

# ---- breadboard geometry --------------------------------------------------
DX = 26
DY = 22
ROWS_TOP = ["j", "i", "h", "g", "f"]
ROWS_BOT = ["e", "d", "c", "b", "a"]
X0 = 126
Y_RAIL_TOP = (34, 54)
Y_TOP0 = 96
Y_CHANNEL = Y_TOP0 + 5 * DY - 6
Y_BOT0 = Y_CHANNEL + 34
Y_RAIL_BOT = (Y_BOT0 + 5 * DY + 10, Y_BOT0 + 5 * DY + 30)
BOARD_BOTTOM = Y_RAIL_BOT[1] + 24

# ---- Arduino geometry -----------------------------------------------------
UNO_GAP = 58                 # clear air between breadboard and Arduino
UNO_Y0 = BOARD_BOTTOM + UNO_GAP
UNO_H = 118
UNO_DX = 22
DIG_Y = UNO_Y0 + 15          # digital header, along the edge facing the board
PWR_Y = UNO_Y0 + UNO_H - 15  # power + analog header, on the far edge

# left to right, USB end on the left. None is the notch between the groups.
DIG_PINS = ["SCL", "SDA", "AREF", "GND", "13", "12", "11", "10", "9", "8",
            None, "7", "6", "5", "4", "3", "2", "1", "0"]
PWR_PINS = ["IOR", "RST", "3V3", "5V", "GND", "GND", "VIN",
            None, "A0", "A1", "A2", "A3", "A4", "A5"]

INK = "currentColor"
HALO = "var(--surface,#F8F9F7)"
RED = "#C8452F"
BLU = "#3D6FA8"
GRN = "#2E7D46"
YEL = "#C9971C"
COP = "#8E4C21"
RAILS = ("+top", "-top", "+bot", "-bot")


def _txt(x, y, size, fill, anchor, content, mono=True, weight="400", opacity="1", halo=True):
    fam = "IBM Plex Mono,monospace" if mono else "Archivo,Arial,sans-serif"
    common = ('x="%g" y="%g" font-size="%s" text-anchor="%s" font-weight="%s" font-family="%s"'
              % (x, y, size, anchor, weight, fam))
    out = []
    if halo:
        out.append('<text %s fill="none" stroke="%s" stroke-width="3.2" stroke-linejoin="round">%s</text>'
                   % (common, HALO, content))
    out.append('<text %s fill="%s" opacity="%s">%s</text>' % (common, fill, opacity, content))
    return out

def parse(hole):
    m = re.fullmatch(r"([a-j])(\d{1,2})", hole)
    if not m:
        raise ValueError("bad hole %r" % hole)
    return m.group(1), int(m.group(2))


def is_hole(s):
    return bool(re.fullmatch(r"[a-j]\d{1,2}", s))


def node_of(hole):
    """Two holes are the same electrical node if same column and same half."""
    r, c = parse(hole)
    return ("ae" if r in ROWS_BOT else "fj", c)


def _row_y(letter):
    if letter in ROWS_TOP:
        return Y_TOP0 + ROWS_TOP.index(letter) * DY
    if letter in ROWS_BOT:
        return Y_BOT0 + ROWS_BOT.index(letter) * DY
    raise ValueError("bad row letter %r" % letter)


def _rail_y(rail):
    return {"+top": Y_RAIL_TOP[0], "-top": Y_RAIL_TOP[1],
            "-bot": Y_RAIL_BOT[0], "+bot": Y_RAIL_BOT[1]}[rail]


def _rpath(pts, r=9):
    """Path through pts with rounded corners. pts are axis-aligned turns."""
    if len(pts) < 2:
        return ""
    d = ["M %g %g" % pts[0]]
    for i in range(1, len(pts) - 1):
        (px, py), (cx, cy), (nx, ny) = pts[i - 1], pts[i], pts[i + 1]
        v1x, v1y = cx - px, cy - py
        v2x, v2y = nx - cx, ny - cy
        l1 = max(abs(v1x), abs(v1y)) or 1
        l2 = max(abs(v2x), abs(v2y)) or 1
        rr = min(r, l1 / 2, l2 / 2)
        d.append("L %g %g" % (cx - v1x / l1 * rr, cy - v1y / l1 * rr))
        d.append("Q %g %g %g %g" % (cx, cy, cx + v2x / l2 * rr, cy + v2y / l2 * rr))
    d.append("L %g %g" % pts[-1])
    return " ".join(d)


class Board:
    def __init__(self, c0, c1, title="", uno=True):
        self.c0, self.c1 = c0, c1
        self.title = title
        self.uno = uno
        self.parts = []
        self.occupied = {}      # breadboard hole -> what put it there
        self.sockets = {}       # arduino socket -> what it feeds
        self.fed = set()        # rails that something actually drives
        self.used_rails = set() # rails that something expects to be live
        self.batt = None        # a battery pack feeding the rails
        self._gut = 0
        self._pad_top = 64      # room for the lanes wires leave the board by
        self._pad_bot = 46

    # ---- multi-leg parts ----
    def btn(self, *legs):
        """A 4-leg push button. Its body sits over the middle channel."""
        for h in legs:
            self._claim(h, "button leg")
        self.parts.append(("btn", legs, None, None, "", None))
        return self

    def pot(self, a, b, c, label="knob"):
        """A 3-leg potentiometer. b is the middle leg, the one that answers."""
        for h in (a, b, c):
            self._claim(h, "%s leg" % label)
        self.parts.append(("pot", (a, b, c), None, None, label, None))
        return self

    def buz(self, plus, minus, label="buzzer"):
        self._claim(plus, "buzzer long leg")
        self._claim(minus, "buzzer short leg")
        self.parts.append(("buz", (plus, minus), None, None, label, None))
        return self

    def npn(self, e, b, c, label="transistor"):
        for h, n in ((e, "emitter"), (b, "base"), (c, "collector")):
            self._claim(h, "transistor %s" % n)
        self.parts.append(("npn", (e, b, c), None, None, label, None))
        return self

    def blk(self, label, *holes, **kw):
        """Any module or multi-pin part. Its body stands off the board edge, so
        it never sits on top of the holes other parts need."""
        for h in holes:
            self._claim(h, "%s pin" % label)
        if holes:
            top = any(parse(h)[0] in ROWS_TOP for h in holes)
            if top:
                self._pad_top = max(self._pad_top, 150)
            else:
                self._pad_bot = max(self._pad_bot, 130)
        rails = tuple(kw.pop("rails", ()))
        if kw:
            raise TypeError("blk got unexpected %s" % list(kw))
        for r in rails:
            if r not in RAILS:
                raise ValueError("bad rail %r" % r)
            self.used_rails.add(r)
        self.parts.append(("blk", holes, rails, None, label, None))
        return self

    def battery(self, plus_rail, minus_rail, label="6 V battery pack"):
        """A battery pack feeding the rails. Its + rail is NOT Arduino 5V, and
        the diagram says so, because that is the rule Band 6 is built on."""
        for r in (plus_rail, minus_rail):
            if r not in RAILS:
                raise ValueError("bad rail %r" % r)
        if not plus_rail.startswith("+") or not minus_rail.startswith("-"):
            raise ValueError("POLARITY: battery wants a + rail and a - rail, got %s and %s"
                             % (plus_rail, minus_rail))
        self.batt = (plus_rail, minus_rail, label)
        self.fed.add(plus_rail)
        self.fed.add(minus_rail)
        self._pad_bot = max(self._pad_bot, 130)
        self.parts.append(("batt", (plus_rail, minus_rail), None, None, label, None))
        return self

    # ---- placement, each of which claims its holes ----
    def _claim(self, hole, what):
        if hole in self.occupied:
            raise ValueError("HOLE COLLISION: %s wanted by %r but %r is already there"
                             % (hole, what, self.occupied[hole]))
        r, c = parse(hole)
        if not (self.c0 <= c <= self.c1):
            raise ValueError("%s is outside the drawn range %d-%d" % (hole, self.c0, self.c1))
        self.occupied[hole] = what

    def _socket(self, name, what, prefer="dig"):
        """Resolve a socket NAME to one physical socket. An UNO has three GND
        sockets, so 'GND' twice is legal and must land on two different ones."""
        order = [("dig", DIG_PINS), ("pwr", PWR_PINS)]
        if prefer == "pwr":
            order.reverse()
        found = False
        for hdr, pins in order:
            for i, p in enumerate(pins):
                if p != name:
                    continue
                found = True
                if (hdr, i) not in self.sockets:
                    self.sockets[(hdr, i)] = what
                    return (hdr, i)
        if not found:
            raise ValueError("no socket called %r on an UNO" % name)
        raise ValueError("SOCKET COLLISION: every %s socket is already taken; "
                         "%r has nowhere to go" % (name, what))

    def led(self, anode, cathode, colour="red", label=""):
        self._claim(anode, "LED %s long leg" % label)
        self._claim(cathode, "LED %s short leg" % label)
        self.parts.append(("led", anode, cathode, colour, label, None))
        return self

    def res(self, p, q, label="220"):
        self._claim(p, "resistor %s" % label)
        self._claim(q, "resistor %s" % label)
        self.parts.append(("res", p, q, label, "", None))
        return self

    def wire(self, p, q, colour=None, label=""):
        """p is a breadboard hole. q is a hole, a rail, or an Arduino socket."""
        self._claim(p, "wire to %s" % q)
        if is_hole(q):
            self._claim(q, "wire from %s" % p)
            key = None
        elif q in RAILS:
            self.used_rails.add(q)
            key = None
        else:
            key = self._socket(q, "wire from %s" % p, prefer="dig")
        self.parts.append(("wire", p, q, colour, label, key))
        return self

    def power(self, socket, rail, label=""):
        """Feed a breadboard rail from an Arduino power socket. This is the
        wire beginners leave out, so the diagram insists on it."""
        if rail not in RAILS:
            raise ValueError("bad rail %r" % rail)
        if socket in ("5V", "3V3", "VIN") and rail.startswith("-"):
            raise ValueError("POLARITY: %s must not feed the %s rail" % (socket, rail))
        if socket == "GND" and rail.startswith("+"):
            raise ValueError("POLARITY: GND must not feed the %s rail" % rail)
        key = self._socket(socket, "feeds %s rail" % rail, prefer="pwr")
        self.fed.add(rail)
        self.parts.append(("power", socket, rail, None, label, key))
        return self

    def link(self, a, b, label=""):
        """Jumper joining the two + rails or the two - rails. They are NOT
        joined for you."""
        if a[0] != b[0]:
            raise ValueError("LINK POLARITY: cannot join %s to %s" % (a, b))
        self.parts.append(("link", a, b, None, label, None))
        if a in self.fed:
            self.fed.add(b)
        if b in self.fed:
            self.fed.add(a)
        return self

    # ---- the checks ----
    def audit(self):
        dead = sorted(self.used_rails - self.fed)
        if dead:
            raise ValueError(
                "DEAD RAIL: %s used but nothing feeds %s. Add .power('5V','+top') "
                "or .power('GND','-top'). Remember the top and bottom rail pairs "
                "are separate strips." % (", ".join(dead), "it" if len(dead) == 1 else "them"))
        return True

    # ---- render ----
    def svg(self):
        self.audit()
        ncol = self.c1 - self.c0 + 1
        bx, bw = X0 - 26, ncol * DX + 26
        gut_l = bx - 46
        gut_r = bx + bw + 46
        uno_w = (len(DIG_PINS) - 0.4) * UNO_DX + 54
        ux0 = bx
        w = max(gut_r + 30, ux0 + uno_w + 30)
        h = (UNO_Y0 + UNO_H + 46) if self.uno else (BOARD_BOTTOM + 20)
        h += self._pad_bot
        self._ux0 = ux0
        self._body_top = -self._pad_top + 30     # where an off-board module sits
        self._body_bot = (BOARD_BOTTOM + 26) if not self.uno else (BOARD_BOTTOM + 26)

        # A 12-column board and a 45-column board are very different pictures.
        # Each renders at its own natural size rather than being stretched to
        # fill, and on a narrow screen the figure scrolls instead of shrinking
        # the hole names past reading.
        o = ['<svg viewBox="0 %g %g %g" role="img" aria-label="%s" '
             'style="width:%gpx; max-width:100%%; min-width:%gpx">'
             % (-self._pad_top, w, h + self._pad_top, self.title or "Wiring diagram",
                w, min(w, 560)),
             '<defs><circle id="bh" r="3.6" fill="none" stroke="%s" stroke-width="1" opacity=".45"/>'
             '<rect id="sk" x="-6.5" y="-6.5" width="13" height="13" rx="2" fill="none" '
             'stroke="%s" stroke-width="1" opacity=".5"/></defs>' % (INK, INK)]

        # ---- breadboard ----
        o.append('<rect x="%g" y="18" width="%g" height="%g" rx="7" fill="none" stroke="%s" '
                 'stroke-width="1.3" opacity=".55"/>' % (bx, bw, BOARD_BOTTOM - 22, INK))
        o.append('<rect x="%g" y="%g" width="%g" height="26" fill="%s" opacity=".07"/>'
                 % (bx, Y_CHANNEL, bw, INK))
        for rail in ("+top", "-top", "-bot", "+bot"):
            y = _rail_y(rail)
            col = RED if rail.startswith("+") else BLU
            o.append('<line x1="%g" y1="%g" x2="%g" y2="%g" stroke="%s" stroke-width="1.2" opacity=".45"/>'
                     % (bx + 8, y, bx + bw - 8, y, col))
            o.append('<text x="%g" y="%g" font-size="12" fill="%s" text-anchor="middle" '
                     'font-family="Archivo,Arial,sans-serif">%s</text>'
                     % (bx - 13, y + 4, col, "+" if rail.startswith("+") else "−"))
            for n in range(self.c0, self.c1 + 1):
                o.append('<use href="#bh" x="%g" y="%g"/>' % (self._cx(n), y))
        for letter in ROWS_TOP + ROWS_BOT:
            y = _row_y(letter)
            o.append('<text x="%g" y="%g" font-size="10" fill="%s" opacity=".5" text-anchor="middle" '
                     'font-family="IBM Plex Mono,monospace">%s</text>' % (bx - 13, y + 4, INK, letter))
            for n in range(self.c0, self.c1 + 1):
                o.append('<use href="#bh" x="%g" y="%g"/>' % (self._cx(n), y))
        for n in range(self.c0, self.c1 + 1):
            if n % 5 == 0 or n == self.c0:
                o.append('<text x="%g" y="12" font-size="10" fill="%s" opacity=".5" text-anchor="middle" '
                         'font-family="IBM Plex Mono,monospace">%d</text>' % (self._cx(n), INK, n))

        # ---- Arduino ----
        if self.uno:
            o.extend(self._draw_uno(ux0, uno_w, self._pad_bot))

        # ---- wires and parts, under the hole labels ----
        for p in self.parts:
            o.extend(self._draw(p, gut_l, gut_r))

        # ---- name every used hole, on top, with a halo so wires do not cut it ----
        for hole in sorted(self.occupied):
            hx, hy = self._xy(hole)
            o.append('<circle cx="%g" cy="%g" r="4.6" fill="none" stroke="%s" stroke-width="1.4" opacity=".85"/>'
                     % (hx, hy, INK))
            o.extend(_txt(hx, hy + 15, "9", INK, "middle", hole))
        if self.uno:
            o.extend(self._uno_labels(self._ux0, self._pad_bot))
        o.append("</svg>")
        return "\n".join(o)

    # ---- helpers ----
    def _cx(self, n):
        return X0 + (n - self.c0) * DX

    def _xy(self, hole):
        r, c = parse(hole)
        return self._cx(c), _row_y(r)

    def _sock_xy(self, key):
        hdr, i = key
        return (self._ux0 + 36 + i * UNO_DX,
                (DIG_Y if hdr == "dig" else PWR_Y) + self._pad_bot)

    def _rail_touch(self, rail):
        """Where a feed wire lands on a rail. Left end, so it stays clear."""
        n = self.c0 if rail.startswith("+") else self.c0 + 1
        return self._cx(min(n, self.c1)), _rail_y(rail)

    def _nudge(self):
        self._gut += 1
        return (self._gut % 4) * 8

    def _draw_uno(self, ux0, uno_w, dy=0):
        o = []
        o.append('<rect x="%g" y="%g" width="%g" height="%g" rx="8" fill="%s" opacity=".05"/>'
                 % (ux0, (UNO_Y0+dy), uno_w, UNO_H, INK))
        o.append('<rect x="%g" y="%g" width="%g" height="%g" rx="8" fill="none" stroke="%s" '
                 'stroke-width="1.3" opacity=".6"/>' % (ux0, (UNO_Y0+dy), uno_w, UNO_H, INK))
        o.append('<rect x="%g" y="%g" width="34" height="22" rx="3" fill="none" stroke="%s" '
                 'stroke-width="1" opacity=".5"/>' % (ux0 - 12, (UNO_Y0+dy) + 16, INK))
        o.append('<text x="%g" y="%g" font-size="8.5" fill="%s" opacity=".55" text-anchor="middle" '
                 'font-family="IBM Plex Mono,monospace">USB</text>' % (ux0 + 5, (UNO_Y0+dy) + 30, INK))
        o.append('<text x="%g" y="%g" font-size="11" fill="%s" opacity=".55" text-anchor="middle" '
                 'letter-spacing="1.6" font-family="Archivo,Arial,sans-serif">ARDUINO UNO</text>'
                 % (ux0 + uno_w / 2, (UNO_Y0+dy) + UNO_H / 2 + 4, INK))
        for hdr_key, pins, y, above in (("dig", DIG_PINS, (DIG_Y+dy), True),
                                        ("pwr", PWR_PINS, (PWR_Y+dy), False)):
            for i, name in enumerate(pins):
                if name is None:
                    continue
                x = ux0 + 36 + i * UNO_DX
                used = (hdr_key, i) in self.sockets
                o.append('<use href="#sk" x="%g" y="%g"/>' % (x, y))
                if used:
                    o.append('<rect x="%g" y="%g" width="13" height="13" rx="2" fill="%s" opacity=".18"/>'
                             % (x - 6.5, y - 6.5, GRN))
                    o.append('<rect x="%g" y="%g" width="13" height="13" rx="2" fill="none" stroke="%s" '
                             'stroke-width="1.6"/>' % (x - 6.5, y - 6.5, GRN))
        return o

    def _uno_labels(self, ux0, dy=0):
        """Drawn last, so a jumper can never sit on top of a pin name."""
        o = []
        for hdr_key, pins, y, above in (("dig", DIG_PINS, (DIG_Y+dy), True),
                                        ("pwr", PWR_PINS, (PWR_Y+dy), False)):
            for i, name in enumerate(pins):
                if name is None:
                    continue
                x = ux0 + 36 + i * UNO_DX
                used = (hdr_key, i) in self.sockets
                ly = y + 16 if above else y - 12
                o.extend(_txt(x, ly, "8.5", GRN if used else INK, "middle", name,
                              weight="700" if used else "400",
                              opacity=".95" if used else ".4"))
        return o

    def _draw(self, p, gut_l, gut_r):
        kind = p[0]
        out = []
        if kind == "led":
            _, a, c, colour, label, _k = p
            ax, ay = self._xy(a)
            cx, cy = self._xy(c)
            col = {"red": RED, "green": GRN, "yellow": YEL, "blue": BLU}.get(colour, RED)
            mx = (ax + cx) / 2
            by = min(ay, cy) - 36
            out.append('<line x1="%g" y1="%g" x2="%g" y2="%g" stroke="%s" stroke-width="2.2"/>'
                       % (ax, ay, mx - 5, by + 8, INK))
            out.append('<line x1="%g" y1="%g" x2="%g" y2="%g" stroke="%s" stroke-width="1.3"/>'
                       % (cx, cy, mx + 5, by + 8, INK))
            out.append('<path d="M %g %g a 10 10 0 0 1 20 0 v 8 h -20 z" fill="%s" opacity=".85" '
                       'stroke="%s" stroke-width="1"/>' % (mx - 10, by, col, INK))
            # "long" sits outboard of the anode leg, never between the legs
            side = -1 if ax <= cx else 1
            out.extend(_txt(ax + side * 11, ay + 3.5, "11", INK, "middle", "+", opacity=".9"))
            if label:
                out.append('<text x="%g" y="%g" font-size="10" fill="%s" text-anchor="middle" '
                           'font-family="Archivo,Arial,sans-serif">%s</text>' % (mx, by - 7, col, label))
        elif kind == "res":
            _, a, b, label, _s, _k = p
            ax, ay = self._xy(a)
            bx_, by_ = self._xy(b)
            mx, my = (ax + bx_) / 2, min(ay, by_) - 32
            out.append('<polyline points="%g,%g %g,%g %g,%g %g,%g" fill="none" stroke="%s" stroke-width="1.5"/>'
                       % (ax, ay, ax, my, bx_, my, bx_, by_, INK))
            out.append('<rect x="%g" y="%g" width="26" height="10" rx="3" fill="%s" opacity=".2" '
                       'stroke="%s" stroke-width="1"/>' % (mx - 13, my - 5, COP, INK))
            for k in (-7, -3, 4):
                out.append('<line x1="%g" y1="%g" x2="%g" y2="%g" stroke="%s" stroke-width="1.6" opacity=".85"/>'
                           % (mx + k, my - 5, mx + k, my + 5, COP))
            out.extend(_txt(mx, my - 9, "9.5", COP, "middle", label))
        elif kind == "wire":
            _, a, q, colour, label, _k = p
            ax, ay = self._xy(a)
            if q in RAILS:
                col = colour or (RED if q.startswith("+") else BLU)
                qy = _rail_y(q)
                out.append('<line x1="%g" y1="%g" x2="%g" y2="%g" stroke="%s" stroke-width="1.9" '
                           'opacity=".9"/>' % (ax, ay, ax, qy, col))
                out.append('<circle cx="%g" cy="%g" r="2.6" fill="%s"/>' % (ax, qy, col))
            elif is_hole(q):
                col = colour or INK
                qx, qy = self._xy(q)
                out.append('<path d="M %g %g C %g %g %g %g %g %g" fill="none" stroke="%s" '
                           'stroke-width="1.9" opacity=".9"/>'
                           % (ax, ay, ax, ay - 22, qx, qy - 22, qx, qy, col))
                out.append('<circle cx="%g" cy="%g" r="2.6" fill="%s"/>' % (qx, qy, col))
            else:
                col = colour or GRN
                sx, sy = self._sock_xy(_k)
                n = self._nudge()
                # Leave the board by your OWN column, not sideways along a row.
                # Every hole in a column is the same node, so a vertical run
                # tells no lie, and it never looks like it is touching a row it
                # has nothing to do with.
                up = parse(a)[0] in ROWS_TOP
                exit_y = (-20 - n) if up else (BOARD_BOTTOM + 12 + n)
                gx = (gut_l - n) if ax < (gut_l + gut_r) / 2 else (gut_r + n)
                lane = ((UNO_Y0 + self._pad_bot - 26 - n) if sy == DIG_Y + self._pad_bot
                        else (UNO_Y0 + self._pad_bot + UNO_H + 24 + n))
                pts = [(ax, ay), (ax, exit_y), (gx, exit_y), (gx, lane), (sx, lane), (sx, sy)]
                out.append('<path d="%s" fill="none" stroke="%s" stroke-width="1.9" opacity=".9"/>'
                           % (_rpath(pts), col))
                out.append('<circle cx="%g" cy="%g" r="2.6" fill="%s"/>' % (sx, sy, col))
            out.append('<circle cx="%g" cy="%g" r="2.6" fill="%s"/>'
                       % (ax, ay, colour or (RED if str(q).startswith("+") else
                                             BLU if str(q).startswith("-") else GRN)))
        elif kind == "power":
            _, socket, rail, _c, label, _k = p
            col = RED if rail.startswith("+") else BLU
            sx, sy = self._sock_xy(_k)
            rx, ry = self._rail_touch(rail)
            n = self._nudge()
            lane = UNO_Y0 + self._pad_bot + UNO_H + 24 + n
            px = gut_l - 30 - n          # power keeps an outer lane of its own
            pts = [(sx, sy), (sx, lane), (px, lane), (px, ry), (rx, ry)]
            out.append('<path d="%s" fill="none" stroke="%s" stroke-width="2.1" opacity=".95"/>'
                       % (_rpath(pts), col))
            out.append('<circle cx="%g" cy="%g" r="2.8" fill="%s"/>' % (sx, sy, col))
            out.append('<circle cx="%g" cy="%g" r="2.8" fill="%s"/>' % (rx, ry, col))
        elif kind == "btn":
            holes = p[1]
            xs = [self._xy(h)[0] for h in holes]
            ys = [self._xy(h)[1] for h in holes]
            cx, cy = (min(xs) + max(xs)) / 2, (Y_CHANNEL + 13)
            half = max(14, (max(xs) - min(xs)) / 2 + 4)
            for h in holes:
                hx, hy = self._xy(h)
                out.append('<line x1="%g" y1="%g" x2="%g" y2="%g" stroke="%s" stroke-width="1.6"/>'
                           % (hx, hy, hx, cy + (14 if hy > cy else -14), INK))
            out.append('<rect x="%g" y="%g" width="%g" height="30" rx="3" fill="%s" opacity=".13" '
                       'stroke="%s" stroke-width="1.1"/>' % (cx - half, cy - 15, half * 2, INK, INK))
            out.append('<circle cx="%g" cy="%g" r="6.5" fill="%s" opacity=".25" stroke="%s" '
                       'stroke-width="1"/>' % (cx, cy, INK, INK))
            out.extend(_txt(cx + half + 6, cy + 4, "9", INK, "start", "button", opacity=".8"))
        elif kind == "pot":
            (a, b, c) = p[1]
            label = p[4]
            xs = [self._xy(h)[0] for h in (a, b, c)]
            ay = self._xy(a)[1]
            up = parse(a)[0] in ROWS_TOP
            by = ay - 42 if up else ay + 42
            for h in (a, b, c):
                hx, hy = self._xy(h)
                out.append('<line x1="%g" y1="%g" x2="%g" y2="%g" stroke="%s" stroke-width="1.6"/>'
                           % (hx, hy, hx, by + (11 if up else -11), INK))
            out.append('<rect x="%g" y="%g" width="%g" height="22" rx="3" fill="%s" opacity=".13" '
                       'stroke="%s" stroke-width="1.1"/>'
                       % (min(xs) - 8, by - 11, max(xs) - min(xs) + 16, INK, INK))
            out.append('<circle cx="%g" cy="%g" r="8" fill="none" stroke="%s" stroke-width="1.3"/>'
                       % (self._xy(b)[0], by, INK))
            out.append('<line x1="%g" y1="%g" x2="%g" y2="%g" stroke="%s" stroke-width="1.5"/>'
                       % (self._xy(b)[0], by, self._xy(b)[0] + 5, by - 6, INK))
            out.extend(_txt(max(xs) + 14, by + 4, "9", INK, "start", label, opacity=".85"))
        elif kind == "buz":
            (pl, mi) = p[1]
            px, py = self._xy(pl)
            mx_, my_ = self._xy(mi)
            up = parse(pl)[0] in ROWS_TOP
            cx, cy = (px + mx_) / 2, (min(py, my_) - 34) if up else (max(py, my_) + 34)
            for h, sign in ((pl, "+"), (mi, "")):
                hx, hy = self._xy(h)
                out.append('<line x1="%g" y1="%g" x2="%g" y2="%g" stroke="%s" stroke-width="%s"/>'
                           % (hx, hy, cx + (-8 if sign else 8), cy, INK, "2.1" if sign else "1.3"))
            out.append('<circle cx="%g" cy="%g" r="15" fill="%s" opacity=".14" stroke="%s" '
                       'stroke-width="1.2"/>' % (cx, cy, INK, INK))
            out.append('<circle cx="%g" cy="%g" r="3" fill="none" stroke="%s" stroke-width="1"/>'
                       % (cx, cy, INK))
            out.extend(_txt(cx - 13, cy + (16 if up else -8), "11", INK, "middle", "+", opacity=".9"))
            out.extend(_txt(cx, (cy - 21) if up else (cy + 28), "9", INK, "middle", "buzzer",
                            opacity=".8"))
        elif kind == "npn":
            (e, b, c) = p[1]
            xs = [self._xy(h)[0] for h in (e, b, c)]
            ay = self._xy(e)[1]
            up = parse(e)[0] in ROWS_TOP
            by = ay - 40 if up else ay + 40
            for h, nm in ((e, "E"), (b, "B"), (c, "C")):
                hx, hy = self._xy(h)
                out.append('<line x1="%g" y1="%g" x2="%g" y2="%g" stroke="%s" stroke-width="1.6"/>'
                           % (hx, hy, hx, by + (10 if up else -10), INK))
                out.extend(_txt(hx, hy + (-8 if up else 16), "8", INK, "middle", nm, opacity=".7"))
            x0, x1 = min(xs) - 8, max(xs) + 8
            out.append('<path d="M %g %g L %g %g A 12 12 0 0 %d %g %g Z" fill="%s" opacity=".16" '
                       'stroke="%s" stroke-width="1.1"/>'
                       % (x0, by + (10 if up else -10), x1, by + (10 if up else -10),
                          1 if up else 0, x0, by + (10 if up else -10), INK, INK))
            out.extend(_txt(x1 + 6, by + 4, "9", INK, "start", "transistor", opacity=".8"))
        elif kind == "blk":
            holes = p[1]
            label = p[4]
            if not holes:
                return out
            xs = [self._xy(h)[0] for h in holes]
            ys = [self._xy(h)[1] for h in holes]
            up = parse(holes[0])[0] in ROWS_TOP
            by = self._body_top if up else (BOARD_BOTTOM + 84)
            x0, x1 = min(xs) - 10, max(xs) + 10
            if x1 - x0 < 90:
                mid = (x0 + x1) / 2
                x0, x1 = mid - 45, mid + 45
            for h in holes:
                hx, hy = self._xy(h)
                out.append('<line x1="%g" y1="%g" x2="%g" y2="%g" stroke="%s" stroke-width="1.5" '
                           'opacity=".85"/>' % (hx, hy, hx, by + (16 if up else -16), INK))
            out.append('<rect x="%g" y="%g" width="%g" height="32" rx="4" fill="%s" opacity=".13" '
                       'stroke="%s" stroke-width="1.2"/>' % (x0, by - 16, x1 - x0, INK, INK))
            out.extend(_txt((x0 + x1) / 2, by + 4, "10", INK, "middle", label, mono=False,
                            opacity=".92"))
            for k, rail in enumerate(p[2] or ()):
                col = RED if rail.startswith("+") else BLU
                ry = _rail_y(rail)
                sx = x0 + 18 + k * 26
                rx = self._cx(min(self.c1, self.c0 + 1 + k))
                lane = (by - 26) if up else (by + 26)
                gx = self._cx(self.c0) - 62 - k * 9
                pts = [(sx, by + (-16 if up else 16)), (sx, lane), (gx, lane), (gx, ry), (rx, ry)]
                out.append('<path d="%s" fill="none" stroke="%s" stroke-width="2" opacity=".95"/>'
                           % (_rpath(pts), col))
                out.append('<circle cx="%g" cy="%g" r="2.6" fill="%s"/>' % (rx, ry, col))
        elif kind == "batt":
            plus_rail, minus_rail = p[1]
            label = p[4]
            bx0 = self._cx(self.c1) - 150
            by = BOARD_BOTTOM + 84
            out.append('<rect x="%g" y="%g" width="150" height="30" rx="4" fill="%s" opacity=".12" '
                       'stroke="%s" stroke-width="1.2"/>' % (bx0, by - 15, INK, INK))
            out.extend(_txt(bx0 + 75, by + 4, "10", INK, "middle", label, mono=False, opacity=".92"))
            for rail, dx, col in ((plus_rail, 34, RED), (minus_rail, 116, BLU)):
                rx = self._cx(self.c1) - 4 if rail.startswith("+") else self._cx(self.c1) - 30
                ry = _rail_y(rail)
                lane = self._cx(self.c1) + (26 if rail.startswith("+") else 44)
                pts = [(bx0 + dx, by - 15), (bx0 + dx, by - 34), (lane, by - 34),
                       (lane, ry), (rx, ry)]
                out.append('<path d="%s" fill="none" stroke="%s" stroke-width="2.1" opacity=".95"/>'
                           % (_rpath(pts), col))
                out.append('<circle cx="%g" cy="%g" r="2.8" fill="%s"/>' % (rx, ry, col))
        elif kind == "link":
            _, a, b, _c, label, _k = p
            col = RED if a.startswith("+") else BLU
            ax_, ay_ = self._cx(self.c1), _rail_y(a)
            bx_, by_ = self._cx(self.c1), _rail_y(b)
            lane = self._cx(self.c1) + 20
            pts = [(ax_, ay_), (lane, ay_), (lane, by_), (bx_, by_)]
            out.append('<path d="%s" fill="none" stroke="%s" stroke-width="2.1" opacity=".95" '
                       'stroke-dasharray="none"/>' % (_rpath(pts), col))
            out.append('<circle cx="%g" cy="%g" r="2.8" fill="%s"/>' % (ax_, ay_, col))
            out.append('<circle cx="%g" cy="%g" r="2.8" fill="%s"/>' % (bx_, by_, col))
        return out


def check_against_text(board, html_text, name):
    """Every hole the diagram uses must appear in the page text, and vice versa."""
    in_text = set(re.findall(r"<code>([a-j]\d{1,2})</code>", html_text))
    in_svg = set(board.occupied)
    only_svg = in_svg - in_text
    only_txt = in_text - in_svg
    msgs = []
    if only_svg:
        msgs.append("  in the diagram but never named in the text: %s" % sorted(only_svg))
    if only_txt:
        msgs.append("  named in the text but not in the diagram: %s" % sorted(only_txt))
    if msgs:
        print("MISMATCH %s" % name)
        print("\n".join(msgs))
        return False
    print("MATCH    %s  (%d holes agree)" % (name, len(in_svg)))
    return True

"""
Every wiring diagram in the course, defined once, in the same hole names the
pages use.

Nothing here is drawn freehand. Each build was transcribed from its page with
the quoted sentence beside it, and every one of the generator's guards runs on
every build: two legs in one hole, a rail nothing feeds, a 5V wire into a minus
rail, an Arduino socket claimed twice. A build that breaks one of those does not
render, it raises.

Run:  python3 diagrams.py          builds every SVG into site-build/repo/assets/wiring
      python3 diagrams.py --check  builds nothing, just runs the guards and the
                                   hole-by-hole diff against each page's text
"""
import io, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bbdraw as B

HERE = os.path.dirname(os.path.abspath(__file__))
BUILDS = []


def build(fn):
    BUILDS.append(fn)
    return fn


# =========================================================================
# Bands 0 to 2. Top rail pair throughout, "nearest row j".
# =========================================================================

@build
def b1p5():
    """Band 1 Part 5: one light."""
    b = B.Board(1, 14, title="Band 1 Part 5: one light on pin 8")
    b.led("f5", "f6", "red")
    b.res("j5", "j3", "220")
    b.wire("h3", "8")
    b.wire("j6", "-top")
    b.power("GND", "-top")
    return "b1p5", b, "pack2/band1.body.html"


@build
def b1p6():
    """Band 1 Part 6: the three-light tower. Part 5's light becomes the red one
    and its pin wire moves from 8 to 9."""
    b = B.Board(1, 20, title="Band 1 Part 6: the signal tower")
    b.led("f5", "f6", "red")
    b.res("j5", "j3", "220")
    b.wire("h3", "9")
    b.wire("j6", "-top")
    b.led("f10", "f11", "yellow")
    b.res("j10", "j8", "220")
    b.wire("h8", "8")
    b.wire("j11", "-top")
    b.led("f15", "f16", "green")
    b.res("j15", "j13", "220")
    b.wire("h13", "7")
    b.wire("j16", "-top")
    b.power("GND", "-top")
    return "b1p6", b, "pack2/band1.body.html"


@build
def b2p5():
    """Band 2 Part 5: the same one light, moved to a ~ pin."""
    b = B.Board(1, 14, title="Band 2 Part 5: one light on pin 9")
    b.led("f5", "f6", "red")
    b.res("j5", "j3", "220")
    b.wire("h3", "9")
    b.wire("j6", "-top")
    b.power("GND", "-top")
    return "b2p5", b, "pack2/band2.body.html"


@build
def b2p7():
    """Band 2 Part 7: the RGB LED, common cathode. Shared leg to the - rail."""
    b = B.Board(1, 15, title="Band 2 Part 7: RGB LED, common cathode")
    b.blk("RGB LED  red / long / green / blue", "f5", "f6", "f7", "f8")
    b.wire("j6", "-top")
    b.res("j5", "j2", "220")
    b.wire("h2", "9")
    b.res("j7", "j10", "220")
    b.wire("h10", "10")
    b.res("j8", "j12", "220")
    b.wire("h12", "11")
    b.power("GND", "-top")
    return "b2p7", b, "pack2/band2.body.html"


@build
def b2p7b():
    """Band 2 Part 7, the other kind: common anode. The shared leg moves to the
    + rail, which is the outer strip on the same top edge, and a new 5V feed
    goes with it. The numbers still have to be inverted in the sketch."""
    b = B.Board(1, 15, title="Band 2 Part 7: RGB LED, common anode")
    b.blk("RGB LED  red / long / green / blue", "f5", "f6", "f7", "f8")
    b.wire("j6", "+top")
    b.res("j5", "j2", "220")
    b.wire("h2", "9")
    b.res("j7", "j10", "220")
    b.wire("h10", "10")
    b.res("j8", "j12", "220")
    b.wire("h12", "11")
    b.power("5V", "+top")
    return "b2p7b", b, "pack2/band2.body.html"


# =========================================================================
# Band 3. Bottom rail pair, "nearest row a".
# =========================================================================

@build
def b3p3():
    """Band 3 Part 3: the button on its own. The simplest circuit in the
    course, and the only one with no resistor at all."""
    b = B.Board(1, 12, title="Band 3 Part 3: one button")
    b.btn("f1", "f3", "e1", "e3")
    b.wire("j1", "2")
    b.wire("a3", "-bot")
    b.power("GND", "-bot")
    return "b3p3", b, "pack3/band3.body.html"


@build
def b3p6():
    """Band 3 Part 6: the Part 3 button, which stays, plus one light."""
    b = B.Board(1, 22, title="Band 3 Part 6: button and light")
    b.btn("f1", "f3", "e1", "e3")
    b.wire("j1", "2")
    b.wire("a3", "-bot")
    b.led("b18", "b20", "green")
    b.res("a18", "a16", "220")
    b.wire("b16", "8")
    b.wire("a20", "-bot")
    b.power("GND", "-bot")
    return "b3p6", b, "pack3/band3.body.html"


@build
def b3p11():
    """Band 3 Part 11: the four-button lock."""
    b = B.Board(1, 34, title="Band 3 Part 11: the lock")
    for cols, pin in ((("f1", "f3", "e1", "e3"), "2"), (("f5", "f7", "e5", "e7"), "3"),
                      (("f9", "f11", "e9", "e11"), "4"), (("f13", "f15", "e13", "e15"), "5")):
        b.btn(*cols)
        b.wire("j" + cols[0][1:], pin)
        b.wire("a" + cols[1][1:], "-bot")
    b.led("b18", "b20", "green")
    b.res("a18", "a16", "220")
    b.wire("b16", "8")
    b.wire("a20", "-bot")
    b.led("b23", "b25", "red")
    b.res("a23", "a21", "220")
    b.wire("b21", "9")
    b.wire("a25", "-bot")
    b.buz("b27", "b29")
    b.wire("a27", "10")
    b.res("a29", "a31", "220")
    b.wire("b31", "-bot")
    b.power("GND", "-bot")
    return "b3p11", b, "pack3/band3.body.html"


# =========================================================================
# Band 4. Top rail pair: every build puts its parts in rows f to j.
# =========================================================================

@build
def b4p5():
    """Band 4 Part 5: the knob alone. Both outside legs must reach a rail, or
    the divider has nothing to divide."""
    b = B.Board(1, 14, title="Band 4 Part 5: the knob")
    b.pot("f5", "f6", "f7")
    b.wire("j5", "+top")
    b.wire("j7", "-top")
    b.wire("j6", "A0")
    b.power("5V", "+top")
    b.power("GND", "-top")
    return "b4p5", b, "pack3/band4.body.html"


@build
def b4p6():
    """Band 4 Part 6: knob plus a light on a ~ pin."""
    b = B.Board(1, 25, title="Band 4 Part 6: knob and light")
    b.pot("f5", "f6", "f7")
    b.wire("j5", "+top")
    b.wire("j7", "-top")
    b.wire("j6", "A0")
    b.led("f20", "f22", "red")
    b.res("j20", "j18", "220")
    b.wire("h18", "9")
    b.wire("j22", "-top")
    b.power("5V", "+top")
    b.power("GND", "-top")
    return "b4p6", b, "pack3/band4.body.html"


@build
def b4p7():
    """Band 4 Part 7 and Part 10: the night guard. The light sensor and its
    10k partner make a divider of their own, read at the middle point."""
    b = B.Board(1, 25, title="Band 4 Part 7: knob, light sensor and light")
    b.pot("f5", "f6", "f7")
    b.wire("j5", "+top")
    b.wire("j7", "-top")
    b.wire("j6", "A0")
    b.blk("light sensor", "f12", "f14")
    b.wire("j12", "+top")
    b.res("j14", "j16", "10k")
    b.wire("h16", "-top")
    b.wire("h14", "A1")
    b.led("f20", "f22", "red")
    b.res("j20", "j18", "220")
    b.wire("h18", "9")
    b.wire("j22", "-top")
    b.power("5V", "+top")
    b.power("GND", "-top")
    return "b4p7", b, "pack3/band4.body.html"


# =========================================================================
# Band 5. Bottom rail pair. Runs out to column 42, so a full-size board.
# =========================================================================

@build
def b5p4():
    """Band 5 Part 4: four lights, four buttons and a buzzer."""
    b = B.Board(1, 45, title="Band 5 Part 4: four lights, four buttons, one buzzer")
    for (anode, cathode, ra, rb, pw, gw, pin, col) in (
            ("b3", "b4", "a3", "a1", "b1", "a4", "2", "red"),
            ("b7", "b8", "a7", "a5", "b5", "a8", "3", "green"),
            ("b11", "b12", "a11", "a9", "b9", "a12", "4", "yellow"),
            ("b15", "b16", "a15", "a13", "b13", "a16", "5", "blue")):
        b.led(anode, cathode, col)
        b.res(ra, rb, "220")
        b.wire(pw, pin)
        b.wire(gw, "-bot")
    for (legs, pin, gnd) in ((("e19", "e21", "f19", "f21"), "8", "a21"),
                             (("e24", "e26", "f24", "f26"), "9", "a26"),
                             (("e29", "e31", "f29", "f31"), "10", "a31"),
                             (("e34", "e36", "f34", "f36"), "11", "a36")):
        b.btn(*legs)
        b.wire("j" + legs[0][1:], pin)
        b.wire(gnd, "-bot")
    b.buz("b40", "b42")
    b.wire("a40", "12")
    b.wire("a42", "-bot")
    b.power("GND", "-bot")
    return "b5p4", b, "pack3/band5.body.html"


# =========================================================================
# Band 6. Top rail pair, and from Part 7 the + rail is a 6 V battery, not the
# Arduino. A knob's power leg goes to the Arduino's own 5V pin, never the rail.
# =========================================================================

@build
def b6p5():
    """Band 6 Part 5: the knob drives the servo. Here the + rail is still the
    Arduino's 5V, which is why j7 may sit on it. That changes in Part 7."""
    b = B.Board(1, 14, title="Band 6 Part 5: the knob drives the arm")
    b.pot("f5", "f6", "f7")
    b.wire("j5", "-top")
    b.wire("j6", "A0")
    b.wire("j7", "+top")
    b.power("5V", "+top")
    b.power("GND", "-top")
    return "b6p5", b, "pack4/band6.body.html"


@build
def b6p8():
    """Band 6 Part 8: the gate. The battery feeds the rails, the Arduino shares
    a ground with it, and the knob takes its power from the Arduino alone."""
    b = B.Board(1, 24, title="Band 6 Part 8: the gate")
    b.pot("f5", "f6", "f7")
    b.wire("j5", "-top")
    b.wire("j6", "A0")
    b.wire("j7", "5V")
    b.btn("e19", "e21", "f19", "f21")
    b.wire("j19", "2")
    b.wire("a21", "-top")
    b.led("b3", "b4", "red")
    b.res("a3", "a1", "220")
    b.wire("b1", "7")
    b.wire("a4", "-top")
    b.battery("+top", "-top")
    b.power("GND", "-top")
    return "b6p8", b, "pack4/band6.body.html"


# =========================================================================
# Band 7 and Band 8. Top rail pair, full-size board.
# =========================================================================

@build
def b7p3():
    """Band 7 Part 3: the sensor alone, straight to the Arduino. No rail is
    used yet, and that is why there is no feed wire to draw."""
    b = B.Board(16, 30, title="Band 7 Part 3: the sensor alone")
    b.blk("HC-SR04  VCC / Trig / Echo / GND", "f20", "f21", "f22", "f23")
    b.wire("j20", "5V")
    b.wire("j21", "10")
    b.wire("j22", "11")
    b.wire("j23", "GND")
    return "b7p3", b, "pack4/band7.body.html"


@build
def b7p8i2c():
    """Band 7 Part 8, the I2C screen route: the sensor's power moves onto the
    rails so the screen can share 5V, and the buzzer joins."""
    b = B.Board(16, 45, title="Band 7 Part 8: parking guard, I2C screen")
    b.blk("HC-SR04  VCC / Trig / Echo / GND", "f20", "f21", "f22", "f23")
    b.wire("j20", "+top")
    b.wire("j21", "10")
    b.wire("j22", "11")
    b.wire("j23", "-top")
    b.buz("b40", "b42")
    b.wire("a40", "6")
    b.wire("a42", "-top")
    b.power("5V", "+top")
    b.power("GND", "-top")
    return "b7p8i2c", b, "pack4/band7.body.html"


@build
def b8p3():
    """Band 8 Part 3: one light, one button, five wires and nothing else."""
    b = B.Board(1, 24, title="Band 8 Part 3: the state machine demo")
    b.led("b3", "b4", "red")
    b.res("a3", "a1", "220")
    b.wire("b1", "7")
    b.wire("a4", "-top")
    b.btn("e19", "e21", "f19", "f21")
    b.wire("j19", "2")
    b.wire("a21", "-top")
    b.power("GND", "-top")
    return "b8p3", b, "pack4/band8.body.html"


@build
def b8p8():
    """Band 8 Part 8: the water tank alarm. The sensor is at f24 to f27, not
    Band 7's f20 to f23, because the button already owns columns 19 and 21."""
    b = B.Board(1, 45, title="Band 8 Part 8: the water tank alarm")
    b.blk("HC-SR04  VCC / Trig / Echo / GND", "f24", "f25", "f26", "f27")
    b.wire("j24", "+top")
    b.wire("j25", "10")
    b.wire("j26", "11")
    b.wire("j27", "-top")
    b.led("b3", "b4", "green")
    b.res("a3", "a1", "220")
    b.wire("b1", "7")
    b.wire("a4", "-top")
    b.led("b7", "b8", "red")
    b.res("a7", "a5", "220")
    b.wire("b5", "8")
    b.wire("a8", "-top")
    b.btn("e19", "e21", "f19", "f21")
    b.wire("j19", "2")
    b.wire("a21", "-top")
    b.buz("b40", "b42")
    b.wire("a40", "6")
    b.wire("a42", "-top")
    b.power("5V", "+top")
    b.power("GND", "-top")
    return ("b8p8", b, "pack4/band8.body.html",
            ["pack4/sketches/b8_03_tank_alarm_worked.ino"])


# =========================================================================
# The bench lessons. These are the circuits an absolute beginner meets first,
# so they matter most of all.
# =========================================================================

@build
def benchmm():
    """Bench, the multimeter: Band 1's light rebuilt so it can be probed."""
    b = B.Board(1, 14, title="Bench: the light, rebuilt to be measured")
    b.led("f5", "f6", "red")
    b.res("j5", "j3", "220")
    b.wire("h3", "5V")
    b.wire("j6", "-top")
    b.power("GND", "-top")
    return "benchmm", b, "projects/bench-multimeter.body.html"


@build
def spseries():
    """Bench, series: one loop, two LEDs, one resistor. The current has one
    path, so it is the same everywhere in it."""
    b = B.Board(1, 16, title="Bench: two LEDs in series")
    b.wire("a5", "+bot")
    b.led("b5", "b7", "red")
    b.led("a7", "b9", "red")
    b.res("a9", "a11", "220")
    b.wire("b11", "-bot")
    b.power("5V", "+bot")
    b.power("GND", "-bot")
    return "spseries", b, "projects/bench-series-parallel.body.html"


@build
def spparallel():
    """Bench, parallel: two complete loops side by side, each with its own
    resistor. Same parts, different shape, different answer."""
    b = B.Board(1, 22, title="Bench: two LEDs in parallel")
    b.wire("a5", "+bot")
    b.led("b5", "b7", "red")
    b.res("a7", "a9", "220")
    b.wire("b9", "-bot")
    b.wire("a15", "+bot")
    b.led("b15", "b17", "red")
    b.res("a17", "a19", "220")
    b.wire("b19", "-bot")
    b.power("5V", "+bot")
    b.power("GND", "-bot")
    return "spparallel", b, "projects/bench-series-parallel.body.html"


@build
def spshared():
    """Bench: the RGB fault, on purpose. Two lights sharing one resistor. The
    resistor fixes the TOTAL current and the two colours divide it."""
    b = B.Board(1, 22, title="Bench: two LEDs sharing one resistor")
    b.wire("a5", "+bot")
    b.led("b5", "b7", "red")
    b.wire("a15", "+bot")
    b.led("b15", "b17", "green")
    b.wire("a7", "a17")
    b.res("c17", "c19", "220")
    b.wire("a19", "-bot")
    b.power("5V", "+bot")
    b.power("GND", "-bot")
    return "spshared", b, "projects/bench-series-parallel.body.html"


# =========================================================================
# The project pages.
# =========================================================================

@build
def b3keypad():
    b = B.Board(1, 45, title="Keypad lock")
    b.blk("4x4 keypad", *["a%d" % c for c in range(20, 28)])
    for c, pin in zip(range(20, 28), ["9", "8", "7", "6", "5", "4", "3", "2"]):
        b.wire("b%d" % c, pin)
    b.led("b3", "b4", "green")
    b.res("a3", "a1", "220")
    b.wire("b1", "10")
    b.wire("a4", "-bot")
    b.led("b7", "b8", "red")
    b.res("a7", "a5", "220")
    b.wire("b5", "11")
    b.wire("a8", "-bot")
    b.buz("b40", "b42")
    b.wire("a40", "12")
    b.wire("a42", "-bot")
    b.power("GND", "-bot")
    return "b3keypad", b, "projects/b3-keypad-lock.body.html"


@build
def b4rain():
    b = B.Board(1, 45, title="Rain alarm")
    b.blk("rain sensor board", "a25", "a26", "a27", "a28")
    b.wire("b25", "+bot")
    b.wire("b26", "-bot")
    b.wire("b27", "A0")
    b.led("b3", "b4", "green")
    b.res("a3", "a1", "220")
    b.wire("b1", "7")
    b.wire("a4", "-bot")
    b.led("b7", "b8", "red")
    b.res("a7", "a5", "220")
    b.wire("b5", "8")
    b.wire("a8", "-bot")
    b.buz("b40", "b42")
    b.wire("a40", "6")
    b.wire("a42", "-bot")
    b.power("5V", "+bot")
    b.power("GND", "-bot")
    return "b4rain", b, "projects/b4-rain-alarm.body.html"


@build
def b4room():
    b = B.Board(1, 32, title="Room monitor, three-pin module")
    b.blk("DHT11 module", "a25", "a26", "a27")
    b.wire("b25", "-bot")
    b.wire("b26", "+bot")
    b.wire("b27", "4")
    b.led("b3", "b4", "green")
    b.res("a3", "a1", "220")
    b.wire("b1", "7")
    b.wire("a4", "-bot")
    b.led("b7", "b8", "red")
    b.res("a7", "a5", "220")
    b.wire("b5", "8")
    b.wire("a8", "-bot")
    b.power("5V", "+bot")
    b.power("GND", "-bot")
    return "b4room", b, "projects/b4-room-monitor.body.html"


@build
def b5race():
    b = B.Board(1, 45, title="Reaction race")
    b.led("b3", "b4", "red")
    b.res("a3", "a1", "220")
    b.wire("b1", "7")
    b.wire("a4", "-bot")
    b.btn("e19", "e21", "f19", "f21")
    b.wire("j19", "2")
    b.wire("a21", "-bot")
    b.buz("b40", "b42")
    b.wire("a40", "8")
    b.wire("a42", "-bot")
    b.power("GND", "-bot")
    return "b5race", b, "projects/b5-reaction-race.body.html"


@build
def b6fan():
    """The fan. The motor's current comes from the battery through the + rail
    and never from the Arduino, and the knob's power leg never touches it."""
    b = B.Board(1, 24, title="Fan on a transistor")
    b.npn("e12", "e13", "e14")
    b.res("a13", "a11", "220")
    b.wire("b11", "5")
    b.wire("a12", "-top")
    b.blk("motor, and the diode across it", "a14", "b14", rails=("+top",))
    b.pot("f5", "f6", "f7")
    b.wire("j5", "-top")
    b.wire("j6", "A0")
    b.wire("j7", "5V")
    b.led("b3", "b4", "red")
    b.res("a3", "a1", "220")
    b.wire("b1", "7")
    b.wire("a4", "-top")
    b.btn("e19", "e21", "f19", "f21")
    b.wire("j19", "2")
    b.wire("a21", "-top")
    b.battery("+top", "-top")
    b.power("GND", "-top")
    return "b6fan", b, "projects/b6-fan-transistor.body.html"


@build
def b6step():
    b = B.Board(1, 24, title="Stepper dial")
    b.pot("f5", "f6", "f7")
    b.wire("j5", "-top")
    b.wire("j6", "A0")
    b.wire("j7", "5V")
    b.btn("e19", "e21", "f19", "f21")
    b.wire("j19", "2")
    b.wire("a21", "-top")
    b.battery("+top", "-top")
    b.power("GND", "-top")
    return "b6step", b, "projects/b6-stepper-dial.body.html"


@build
def tm1637():
    b = B.Board(16, 45, title="Parking guard on a TM1637 display")
    b.blk("HC-SR04  VCC / Trig / Echo / GND", "f20", "f21", "f22", "f23")
    b.wire("j20", "+top")
    b.wire("j21", "10")
    b.wire("j22", "11")
    b.wire("j23", "-top")
    b.buz("b40", "b42")
    b.wire("a40", "6")
    b.wire("a42", "-top")
    b.power("5V", "+top")
    b.power("GND", "-top")
    return ("tm1637", b, "projects/b7-guard-tm1637.body.html",
            ["pack4/band7.body.html"])


# =========================================================================

def main():
    check_only = "--check" in sys.argv
    out = os.path.join(HERE, "wiring")
    if not check_only:
        os.makedirs(out, exist_ok=True)
    ok = bad = 0
    for fn in BUILDS:
        try:
            r = fn()
        except Exception as e:
            print("RAISED  %-12s %s" % (fn.__name__, e))
            bad += 1
            continue
        if r is None:
            continue
        extra = []
        if len(r) == 4:
            name, board, page, extra = r
        else:
            name, board, page = r
        try:
            svg = board.svg()
        except Exception as e:
            print("RAISED  %-12s %s" % (name, e))
            bad += 1
            continue
        # every hole the picture uses must be a hole the page names
        txt = io.open(os.path.join(HERE, page), encoding="utf-8").read()
        in_text = set(re.findall(r"<code>([a-j]\d{1,2})</code>", txt))
        for other in extra:
            more = io.open(os.path.join(HERE, other), encoding="utf-8").read()
            in_text |= set(re.findall(r"<code>([a-j]\d{1,2})</code>", more))
            in_text |= set(re.findall(r"\b([a-j]\d{1,2})\b", more))   # sketch headers
        missing = sorted(set(board.occupied) - in_text)
        if missing:
            print("UNQUOTED %-12s holes in the picture that the page never names: %s"
                  % (name, missing))
            bad += 1
            continue
        if not check_only:
            io.open(os.path.join(out, name + ".svg"), "w", encoding="utf-8").write(svg)
        ok += 1
        print("ok      %-12s %2d holes, %2d sockets, %s"
              % (name, len(board.occupied), len(board.sockets), page.split("/")[-1]))
    print("\n%d diagrams, %d problems" % (ok, bad))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())

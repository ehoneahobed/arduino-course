"""
Put each generated wiring diagram on the page it belongs to.

An anchor is a string that must appear EXACTLY ONCE on its page. If it appears
none or twice, this refuses to run rather than guessing, because a diagram
placed next to the wrong build is worse than no diagram at all.

Re-running is safe: an existing placeholder for the same diagram is replaced,
not duplicated.
"""
import io, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))

# name, page, anchor (inserted AFTER it), caption
PLACES = [
 ("b1p5var", "pack2/band1.body.html",
  '<h3 style="margin-top:1rem">Now test the thing you were asked to predict</h3>',
  "The same circuit with the resistor on the far side of the LED. Compare it "
  "with the picture above: the loop is the same loop, in a different order."),
 ("b2p7b", "pack2/band2.body.html",
  '<div class="ifnot"><b>If everything is bright when the sketch says off, and dark when it says white</b>',
  "The common-anode kind. The shared leg moves to the <b>+ rail</b>, the outer "
  "strip on the same top edge, and one new wire runs from that rail to 5V. The "
  "three resistors and the three pin wires do not move."),
 ("b1traffic", "projects/b1-traffic-module.body.html",
  '<div class="parthead"><span class="tag">Build</span>',
  "Four module pins, five wires. This page names no holes on purpose: the only "
  "rule is four <em>different</em> columns, one pin per column."),
 ("b2rgbmod", "projects/b2-rgb-module.body.html",
  '<div class="parthead"><span class="tag">Build</span>',
  "Nothing of this module goes in the breadboard. The board is here for one "
  "thing only: the &#8722; rail the module's fourth pin returns to."),
 ("b4roomb", "projects/b4-room-monitor.body.html",
  '<p style="margin-top:.7rem">The 10k resistor holds the data line up when nobody is talking,',
  "The bare part. Column 32 stays empty, and the 10k goes in row <code>c</code> "
  "because row <code>b</code> already holds a wire."),
 ("b6p7", "pack4/band6.body.html",
  '<div class="parthead"><span class="tag">Part 7</span>',
  "Two wires leave the Arduino and neither is 5V: the signal on pin 9, and the "
  "ground link. The battery does the work; the ground link is what makes the "
  "signal mean anything."),
 ("b7p6a", "pack4/band7.body.html",
  '<h3 style="margin-top:.4rem">6a. The I&#178;C kind, four wires</h3>',
  "The sensor's two power wires move off the Arduino and onto the rails, so the "
  "screen can share the one 5V pin. Trig and Echo do not move."),
 ("b7p6b", "pack4/band7.body.html",
  '<h3 style="margin-top:.9rem">6b. The bare kind, twelve wires and a knob</h3>',
  "Twenty wires. Screen pins 7, 8, 9 and 10 are deliberately empty, and Echo "
  "has moved to pin 9 because the screen has taken pin 11."),
 ("b7p8i2c", "pack4/band7.body.html",
  '<div class="parthead"><span class="tag">Part 8</span>',
  "The finished guard, on the I&#178;C route. The buzzer sits down in rows "
  "<code>a</code> and <code>b</code>, so its rail wire runs the long way round "
  "to the top pair."),
 ("b8p10", "pack4/band8.body.html",
  '<div class="parthead"><span class="tag">Part 10</span>',
  "What a wiring drawing has to show. Note the two separate wires on the "
  "&#8722; rail: the battery's black one, and the ground link. Neither does the "
  "other's job."),
 ("b1p5", "pack2/band1.body.html",
  '<p>Here is what you are building. Follow the picture first, then the steps.</p>',
  "The whole of Part 5. Every hole in this picture is named in the steps below, "
  "and the <b>+</b> marks the LED's long leg."),
 ("b1p6", "pack2/band1.body.html",
  '<div class="parthead"><span class="tag">Part 6</span><h2>Build all three</h2><span class="mins">45 min</span></div>\n  <div class="col stack">',
  "All three lights. The red one is Part 5's, unmoved; only its pin wire has "
  "gone from 8 to 9."),
 ("b2p5", "pack2/band2.body.html",
  '<div class="parthead"><span class="tag">Part 5</span>',
  "Band 1's circuit exactly, on pin 9 instead of pin 8. Pin 9 has a "
  "<code>~</code> beside it and pin 8 does not."),
 ("b2p7", "pack2/band2.body.html",
  '<div class="parthead"><span class="tag">Part 7</span>',
  "The common-cathode kind: the long shared leg goes to the &#8722; rail. "
  "Three resistors, one per colour, because each colour is its own light."),
 ("b3p3", "pack3/band3.body.html",
  '<div class="parthead"><span class="tag">Part 3</span>',
  "The simplest circuit in the course. Two wires, no resistor, and the button's "
  "body sitting over the middle channel."),
 ("b3p6", "pack3/band3.body.html",
  '<div class="parthead"><span class="tag">Part 6</span>',
  "The Part 3 button stays exactly where it is. Only the light is new, and it "
  "goes in the bottom block so it shares the same &#8722; rail."),
 ("b3p11", "pack3/band3.body.html",
  '<div class="parthead"><span class="tag">Part 11</span>',
  "The finished lock. Four buttons over the channel, two lights and a buzzer in "
  "the bottom block, and one ground wire for all of them."),
 ("b4p5", "pack3/band4.body.html",
  '<div class="parthead"><span class="tag">Part 5</span>',
  "Both of the knob's outside legs reach a rail. A divider with only one end "
  "connected divides nothing."),
 ("b4p6", "pack3/band4.body.html",
  '<div class="parthead"><span class="tag">Part 6</span>',
  "The knob has not moved. The light is new, and its pin wire is in row "
  "<code>h</code> because the resistor already owns <code>j18</code>."),
 ("b4p7", "pack3/band4.body.html",
  '<div class="parthead"><span class="tag">Part 7</span>',
  "Two dividers side by side. The knob's answer comes off its middle leg; the "
  "sensor's comes off the point between it and the 10k."),
 ("b5p4", "pack3/band5.body.html",
  '<div class="parthead"><span class="tag">Part 4</span>',
  "Nine parts, twenty-one wires, one ground. Worth counting against your own "
  "board before you plug anything in."),
 ("b6p5", "pack4/band6.body.html",
  '<div class="parthead"><span class="tag">Part 5</span>',
  "Here the + rail is still the Arduino's 5V, which is why the knob's "
  "<code>j7</code> may sit on it. That changes in Part 7 and never changes back."),
 ("b6p8", "pack4/band6.body.html",
  '<div class="parthead"><span class="tag">Part 8</span>',
  "Look at what touches the + rail: the battery and the servo, and nothing "
  "else. The knob's power leg runs to the Arduino's own 5V pin instead."),
 ("b7p3", "pack4/band7.body.html",
  '<div class="parthead"><span class="tag">Part 3</span>',
  "Four wires straight to the Arduino. No rail is used yet, so there is no feed "
  "wire to forget."),
 ("b8p3", "pack4/band8.body.html",
  '<div class="parthead"><span class="tag">Part 3</span>',
  "Two parts, five wires, nothing else. Everything hard about this part is in "
  "the sketch."),
 ("b8p8", "pack4/band8.body.html",
  '<div class="parthead"><span class="tag">Part 8</span>',
  "The worked capstone. The sensor is at <code>f24</code> to <code>f27</code>, "
  "not Band 7's <code>f20</code> to <code>f23</code>, because the button "
  "already owns columns 19 and 21."),
 ("benchmm", "projects/bench-multimeter.body.html",
  '<div class="parthead"><span class="tag">Build</span>',
  "Band 1's light, with its far end moved to 5V so it stays on while you "
  "measure it."),
 ("spseries", "projects/bench-series-parallel.body.html",
  '<h2>One after the other: a series circuit</h2><span class="mins">30 min</span></div>',
  "One loop. The current has one path, so it is the same in every part of it, "
  "and one resistor is enough for both lights."),
 ("spparallel", "projects/bench-series-parallel.body.html",
  '<h2>Side by side: a parallel circuit</h2><span class="mins">25 min</span></div>',
  "Two complete loops from the same two rails. Same parts as the series build, "
  "different shape, and each branch needs its own resistor."),
 ("spshared", "projects/bench-series-parallel.body.html",
  '<h3 style="margin-top:.8rem">Why the RGB LED needs three resistors and not one</h3>',
  "The RGB fault, built on purpose. One resistor for two lights fixes the "
  "<em>total</em> current, and the two colours divide it between them."),
 ("b3keypad", "projects/b3-keypad-lock.body.html",
  '<div class="parthead"><span class="tag">Build</span>',
  "Sixteen buttons on eight wires. The keypad's own pins fill row "
  "<code>a</code>, so every jumper goes into row <code>b</code>."),
 ("b4rain", "projects/b4-rain-alarm.body.html",
  '<div class="parthead"><span class="tag">Build</span>',
  "Read the printing on your own sensor board. The three wires go by name, not "
  "by position, because the pin order differs between boards."),
 ("b4room", "projects/b4-room-monitor.body.html",
  '<div class="parthead"><span class="tag">Build</span>',
  "The three-pin module. Same warning: match each wire to the printing on your "
  "own board rather than counting positions."),
 ("b5race", "projects/b5-reaction-race.body.html",
  '<div class="parthead"><span class="tag">Build</span>',
  "Seven wires. Band 5's board with everything but one light, one button and "
  "the buzzer taken off."),
 ("b6fan", "projects/b6-fan-transistor.body.html",
  '<div class="parthead"><span class="tag">Build</span>',
  "The motor's current comes from the battery, through the + rail, and never "
  "from the Arduino. The knob's <code>j7</code> goes to the 5V pin on its own."),
 ("b6step", "projects/b6-stepper-dial.body.html",
  '<div class="parthead"><span class="tag">Build</span>',
  "The driver board and the battery are the only things on the + rail. Four "
  "wires on the two rails before you add anything else."),
 ("tm1637", "projects/b7-guard-tm1637.body.html",
  '<div class="parthead"><span class="tag">Build</span>',
  "The sensor's four holes do not move. Three of its wires do: VCC and GND go "
  "to the rails, and Echo goes back to pin 11."),
]

FIG = ('\n    <figure class="wiring">\n      <!--SVG:wire_%s-->\n'
       '      <figcaption>%s</figcaption>\n    </figure>')


def main():
    seen = {}
    for name, page, anchor, cap in PLACES:
        path = os.path.join(HERE, page)
        s = io.open(path, encoding="utf-8").read()
        # idempotent: drop any previous copy of this figure first
        s = re.sub(r'\n    <figure class="wiring">\s*<!--SVG:wire_%s-->.*?</figure>' % name,
                   "", s, flags=re.S)
        n = s.count(anchor)
        if n != 1:
            print("ANCHOR %-10s appears %d times on %s: %r" % (name, n, page, anchor[:60]))
            return 1
        i = s.index(anchor) + len(anchor)
        # a parthead anchor names the heading; the figure belongs after it,
        # not wedged between the tag and the title
        if "parthead" in anchor and not anchor.rstrip().endswith("</div>"):
            i = s.index("</div>", i) + len("</div>")
        s = s[:i] + (FIG % (name, cap)) + s[i:]
        io.open(path, "w", encoding="utf-8").write(s)
        seen.setdefault(page, 0)
        seen[page] += 1
        print("placed %-10s in %s" % (name, page.split("/")[-1]))
    print("\n%d diagrams placed across %d pages" % (len(PLACES), len(seen)))
    return 0


if __name__ == "__main__":
    sys.exit(main())

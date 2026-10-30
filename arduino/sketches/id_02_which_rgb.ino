// ==================================================================
//   WHICH RGB LIGHT HAVE I GOT, AND WHICH WAY ROUND IS IT?
//
//   There are two shapes of RGB light in these kits, and each shape
//   comes in two wirings. Four possibilities, and every one of them
//   needs a slightly different Band 2.
//
//   This sketch sorts it out. Read the whole comment first.
//
//   ---------------------------------------------------------------
//   STEP ONE: WHICH SHAPE?  (look, do not wire anything yet)
//
//     A loose dome with FOUR legs, one longer than the others
//        -> you have a DISCRETE RGB LED. It needs three resistors,
//           which you fit yourself. Band 2's core build is for you.
//
//     A small board with a light on it and a row of pins
//        -> you have an RGB MODULE. The resistors are already on
//           the board. Band 2's module path is for you.
//
//     Both -> use the discrete one for the core build. The module
//           is then a Swap you can do afterwards in half the time.
//
//   ---------------------------------------------------------------
//   STEP TWO: WIRE IT UP FOR THIS TEST
//
//     DISCRETE RGB LED
//       Push the four legs into f5, f6, f7, f8 with the LONGEST leg
//       in f6.
//       Resistor from j5 to j2,   wire h2  to pin 9
//       Resistor from j7 to j10,  wire h10 to pin 10
//       Resistor from j8 to j12,  wire h12 to pin 11
//       Wire j6 to the MINUS rail, and the minus rail to GND.
//
//       IF NOTHING LIGHTS AT ALL IN ANY OF THE FIVE STEPS:
//       yours is the COMMON ANODE kind, and its long leg wants
//       5V rather than ground.
//
//       UNPLUG THE USB FIRST. Move the j6 wire from the MINUS
//       rail to the PLUS rail -- the OUTER strip along the same
//       edge, the one marked with a red line and a + sign, not
//       the inner one. Then run one wire from that same PLUS
//       rail to the Arduino's 5V pin.
//
//       THEN CHECK BY EYE BEFORE PLUGGING BACK IN. This is the
//       only step here that puts 5V onto the breadboard, and
//       joining 5V to GND is the one mistake that damages the
//       board. No wire from the PLUS rail to a GND pin. No wire
//       from the MINUS rail to 5V. Both true? Plug in.
//
//       It will now light, and "all on" will be DARK.
//
//     RGB MODULE
//       Four pins, usually marked R G B and one of - or GND or VCC.
//       R   -> pin 9
//       G   -> pin 10
//       B   -> pin 11
//       -   -> GND        (if the fourth pin is marked - or GND)
//       VCC -> 5V         (if the fourth pin is marked VCC or +)
//       No resistors of your own IF the back of the board has
//       three tiny black rectangles on it. If the back is bare,
//       put a 220 ohm resistor in each of the three colour
//       wires. See the note further down.
//
//       A module whose fourth pin is marked VCC or + is the
//       COMMON ANODE kind. "All on" will come out dark and "all
//       off" white. Nothing is wrong; write it down.
//
//       TURN THE MODULE OVER FIRST. Most RGB modules have three
//       tiny black rectangles on the back: those are the
//       resistors and you need none of your own. Some have a
//       bare back and NO resistors at all. If yours is bare, put
//       a 220 ohm resistor in each of the three colour wires
//       yourself, or you will damage both the light and the pin.
//       If you cannot tell, add them anyway: on a module that
//       already has them the light is only a little dimmer.
//
//   ---------------------------------------------------------------
//   STEP THREE: RUN IT AND WRITE DOWN WHAT YOU SEE
//
//     It shows FIVE things in a row, printing each one as it goes:
//       red, green, blue, then all-on, then all-off.
//     Then it pauses and starts again.
//
//     WHICH WAY ROUND IS IT?
//       "all on" is WHITE and "all off" is DARK
//            -> COMMON CATHODE. 0 is off and 255 is bright.
//               This is what Band 2 assumes. Nothing to change.
//
//       "all on" is DARK and "all off" is WHITE
//            -> COMMON ANODE. TWO STEPS, and you need both.
//
//               ONE, THE WIRING, WHICH IS NOT OPTIONAL. The shared
//               leg goes to 5V. A common-anode part with its
//               shared leg on the minus rail cannot light in any
//               state at all, so if yours is lighting, this is
//               already done. Band 2 Part 12 describes it.
//
//               TWO, THE NUMBERS. Rewiring makes it light. It does
//               NOT un-invert it. With 5V on the shared leg, 255
//               puts five volts on both ends of the light and you
//               get nothing, and 0 gives full brightness. So also
//               write 255 - r instead of r everywhere you set a
//               colour, and every number in the course means what
//               it says again. Or live with the inversion and
//               remember 0 is bright. Write down which you chose.
//
//     DID THE COLOURS COME OUT IN THE RIGHT ORDER?
//       If the sketch says "red" and you see green, your legs are
//       in a different order. Nothing is broken. Swap the wires at
//       the Arduino end until the words match the colours, then
//       write down which pin ended up being which colour.
//
//   KEEP YOUR ANSWERS. Band 2 asks for all three of them.
// ==================================================================

int redPin = 9;
int greenPin = 10;
int bluePin = 11;

void show(int r, int g, int b, const char* label) {
  Serial.println(label);
  analogWrite(redPin, r);
  analogWrite(greenPin, g);
  analogWrite(bluePin, b);
  delay(1200);
}

void setup() {
  pinMode(redPin, OUTPUT);
  pinMode(greenPin, OUTPUT);
  pinMode(bluePin, OUTPUT);
  Serial.begin(9600);
  Serial.println();
  Serial.println("Which RGB light have I got?");
  Serial.println("Watch the light while you read the words.");
  Serial.println();
}

void loop() {
  show(255,   0,   0, "red    (should look RED)");
  show(  0, 255,   0, "green  (should look GREEN)");
  show(  0,   0, 255, "blue   (should look BLUE)");
  show(255, 255, 255, "all on  -> white means COMMON CATHODE, dark means COMMON ANODE");
  show(  0,   0,   0, "all off -> dark means COMMON CATHODE, white means COMMON ANODE");

  Serial.println("-----------------------------------");
  Serial.println();
  delay(1500);
}

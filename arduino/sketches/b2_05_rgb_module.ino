// ==================================================================
//   BAND 2 SWAP  -  THE MOOD LAMP ON AN RGB MODULE
//   Build this if your kit has the RGB MODULE rather than a loose
//   four-legged RGB LED, or after the core build if you have both.
//
//   RUN id_02_which_rgb.ino FIRST if you are not sure which you
//   have, or which way round yours is wired. It takes two minutes
//   and it answers both questions.
//
//   WHAT IS DIFFERENT
//     Three wires and no resistors, instead of three resistors and
//     the wiring that goes with them.
//
//     THE RESISTORS HAVE NOT GONE AWAY. Turn the module over and
//     look at the back BEFORE YOU WIRE ANYTHING. You should find
//     three tiny black rectangles with numbers on them, one per
//     colour. Somebody fitted them for you and charged you for
//     the convenience.
//
//     *** IF THE BACK IS BARE, THERE ARE NO RESISTORS ***
//     Both kinds are sold in these kits and they look the same
//     from the front. A bare module wired straight to a pin and
//     asked for 255 pulls roughly five times what a pin is rated
//     for, and it damages the light and the pin together.
//     If yours is bare, put a 220 ohm resistor in each of the
//     three colour wires yourself. Everything else here is
//     unchanged. If you cannot tell, fit them anyway: on a
//     module that already has them the light is only a little
//     dimmer and nothing is harmed.
//
//     Band 1 taught you why an LED needs a resistor, and Band 2
//     Part 7 why an RGB LED needs THREE and not one. This board
//     does not excuse you from any of that; it just means the
//     resistors are somebody else's decision now. The project
//     page asks you to find them and read the numbers off them.
//
//   WIRING
//     Module      ->  Arduino
//       R  -> pin 9    (a ~ pin)
//       G  -> pin 10   (a ~ pin)
//       B  -> pin 11   (a ~ pin)
//       -  -> the minus rail        if the fourth pin is - or GND
//       +  -> 5V                    if the fourth pin is + or VCC
//     One wire from the minus rail to a GND pin.
//
//     All three colour pins MUST have a ~ next to them, exactly as
//     in the core build. Without one you get off and full on and
//     nothing in between, which is Band 2's whole subject.
//
//   IF 0 IS BRIGHT AND 255 IS DARK
//     You have the common-anode kind. Nothing is wrong.
//
//     Its fourth pin is marked VCC or + and belongs on 5V, and it
//     is already there: that is the only reason it lights at all.
//     A common-anode part with its shared pin on the minus rail
//     cannot light in ANY state. So the wiring is right and
//     moving it cannot help.
//
//     What is left is the numbers, and they really are upside
//     down. Change the three lines in showColour:
//        analogWrite(redPin, 255 - r);
//     and the same for green and blue. Band 2 Part 12 explains it.
//
//   THE SUNRISE
//     Same story as the core build: night, first red light, orange,
//     full day, then back to night. Change the colours to yours.
// ==================================================================

int redPin = 9;
int greenPin = 10;
int bluePin = 11;

int stepDelay = 25;      // the pause between the hundred small steps

void showColour(int r, int g, int b) {
  analogWrite(redPin, r);
  analogWrite(greenPin, g);
  analogWrite(bluePin, b);
}

// Walks from one colour to another in a hundred small steps, so the
// change looks smooth instead of jumping. Straight out of b2_03.
void fadeTo(int r1, int g1, int b1, int r2, int g2, int b2) {
  for (int step = 0; step <= 100; step = step + 1) {
    int r = r1 + (r2 - r1) * step / 100;
    int g = g1 + (g2 - g1) * step / 100;
    int b = b1 + (b2 - b1) * step / 100;
    showColour(r, g, b);
    delay(stepDelay);
  }
}

void setup() {
  pinMode(redPin, OUTPUT);
  pinMode(greenPin, OUTPUT);
  pinMode(bluePin, OUTPUT);
  showColour(0, 0, 0);
}

void loop() {
  fadeTo(  0,   0,   0,    40,   0,  30);   // night into first light
  fadeTo( 40,   0,  30,   255,  40,   0);   // red over the lagoon
  fadeTo(255,  40,   0,   255, 160,  40);   // orange
  fadeTo(255, 160,  40,   255, 255, 200);   // full day
  delay(4000);
  fadeTo(255, 255, 200,   255,  90,   0);   // evening
  fadeTo(255,  90,   0,     0,   0,   0);   // night again
  delay(2000);
}

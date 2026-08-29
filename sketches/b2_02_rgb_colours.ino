// ==================================================================
//   BAND 2, PART 7  -  ONE LED, ANY COLOUR
//
//   WHAT IT DOES
//     Shows red, green, blue, orange, white, then off, one second
//     each, over and over.
//
//   WIRING
//     The RGB LED has four legs. One is longer than the others.
//     Push it in so the four legs land in f5, f6, f7 and f8,
//     with the LONG LEG in f6.
//
//     Wire from j6 to the minus rail, and the minus rail to GND.
//     Resistor from j5 to j2,   wire from j2 to pin 9   (red)
//     Resistor from j7 to j10,  wire from j10 to pin 10 (green)
//     Resistor from j8 to j12,  wire from j12 to pin 11 (blue)
//
//     THREE resistors, one for each colour. Not one shared resistor.
//     An RGB LED is three lights in one case.
//
//   IF THE COLOURS COME OUT WRONG
//     Your legs may be in a different order. Swap the wires at the
//     pin end until red appears when the sketch says red.
//     If 0 gives bright and 255 gives dark, you have the other kind
//     of RGB LED. Band 2 Part 7 tells you what to do about it.
//
//   WHAT IS NEW HERE
//     showColour is a function: a named group of instructions that
//     somebody wrote. It only runs when a line asks for it by name.
//     You are reading this one, not writing it. You write your own
//     at Band 5.
// ==================================================================

int redPin = 9;
int greenPin = 10;
int bluePin = 11;

void showColour(int r, int g, int b) {
  analogWrite(redPin, r);
  analogWrite(greenPin, g);
  analogWrite(bluePin, b);
}

void setup() {
  pinMode(redPin, OUTPUT);
  pinMode(greenPin, OUTPUT);
  pinMode(bluePin, OUTPUT);
}

void loop() {
  showColour(255, 0, 0);
  delay(1000);

  showColour(0, 255, 0);
  delay(1000);

  showColour(0, 0, 255);
  delay(1000);

  showColour(255, 120, 0);
  delay(1000);

  showColour(255, 255, 255);
  delay(1000);

  showColour(0, 0, 0);
  delay(1000);
}

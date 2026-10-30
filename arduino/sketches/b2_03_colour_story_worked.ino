// ==================================================================
//   BAND 2, PART 7  -  A COLOUR STORY (WORKED EXAMPLE)
//
//   WHAT IT DOES
//     Plays a sunrise over the lagoon: night, first red light,
//     orange, full daylight, then back to night. Every change is a
//     smooth fade rather than a jump.
//
//   WIRING
//     Exactly the same as b2_02.
//
//   HOW THE FADE WORKS
//     fadeTo takes six numbers: the colour you are starting from,
//     then the colour you are going to. It walks from one to the
//     other in a hundred small steps, showing each one.
//
//     When step is 0 you get exactly the first colour.
//     When step is 100 you get exactly the second.
//     In between you get a mixture.
//
//   USE THIS AS YOUR STARTING POINT
//     Your Make task is your own colour story. Save a copy of this
//     file under a new name and change the colours to yours.
// ==================================================================

int redPin = 9;
int greenPin = 10;
int bluePin = 11;

int stepDelay = 25;

void showColour(int r, int g, int b) {
  analogWrite(redPin, r);
  analogWrite(greenPin, g);
  analogWrite(bluePin, b);
}

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
  showColour(0, 0, 25);
}

void loop() {
  fadeTo(0, 0, 25,     90, 0, 15);
  fadeTo(90, 0, 15,    255, 70, 0);
  fadeTo(255, 70, 0,   255, 200, 120);
  delay(3000);
  fadeTo(255, 200, 120, 0, 0, 25);
  delay(3000);
}

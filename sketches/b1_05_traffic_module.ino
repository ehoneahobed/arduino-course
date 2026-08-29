// ==================================================================
//   BAND 1 SWAP  -  THE TRAFFIC LIGHT MODULE
//   Build this AFTER you have wired three loose LEDs by hand.
//   Not instead of. The reason is in the project page.
//
//   WHAT IT DOES
//     Exactly what your Signal Tower does: red, red and yellow,
//     green, yellow, round and round. Same sequence, same code,
//     five wires and no resistors instead of seven wires and three.
//
//   WIRING
//     The module has four pins in a row. They are marked on the
//     board itself. Read yours; do not trust this comment.
//     The usual marking is:
//
//       R    -> pin 9      (red)
//       Y    -> pin 8      (yellow)
//       G    -> pin 7      (green)
//       GND  -> the minus rail
//
//     One wire from the minus rail to a GND pin.
//
//     NO RESISTORS. That is the whole point of this build and it
//     is the thing to be suspicious about. The resistors have not
//     gone away. Somebody fitted them for you, on the board, and
//     the project page asks you to go and find them.
//
//   IF THE COLOURS COME OUT IN THE WRONG ORDER
//     Your module's pins are labelled differently. Swap the wires
//     at the Arduino end until red is red, then write down which
//     pin ended up being which colour. Nothing is broken.
//
//   IF NOTHING LIGHTS AT ALL
//     Check the GND wire first. Then check whether your module's
//     fourth pin is marked GND or VCC. A few modules are common
//     ANODE, which means that fourth pin goes to 5V instead, and
//     the lights then come on when the sketch says LOW. If that is
//     yours, swap every HIGH and LOW in this file. It will work.
//
//   COMPARE IT WITH b1_03_signal_variables.ino
//     Put the two files side by side and look for what the module
//     changed. The answer is NOTHING. Same pins, same timings,
//     same states. The only difference is that the four repeated
//     blocks here are folded into one showState function called
//     four times, and that tidying has nothing to do with the
//     module at all.
//
//     That is worth sitting with. You did not learn a new thing.
//     You pointed an old thing at new hardware, and the board
//     could not tell the difference if it tried.
// ==================================================================

int redPin = 9;
int yellowPin = 8;
int greenPin = 7;

int stopTime = 5000;
int changeTime = 1500;
int goTime = 5000;

// Every state sets ALL THREE lights, including the ones that are
// staying off. Band 1 Part 7 explains why that habit is worth the
// extra typing.
void showState(int red, int yellow, int green, int howLong) {
  digitalWrite(redPin, red);
  digitalWrite(yellowPin, yellow);
  digitalWrite(greenPin, green);
  delay(howLong);
}

void setup() {
  pinMode(redPin, OUTPUT);
  pinMode(yellowPin, OUTPUT);
  pinMode(greenPin, OUTPUT);
}

void loop() {
  showState(HIGH, LOW,  LOW,  stopTime);     // stop
  showState(HIGH, HIGH, LOW,  changeTime);   // about to go
  showState(LOW,  LOW,  HIGH, goTime);       // go
  showState(LOW,  HIGH, LOW,  changeTime);   // about to stop
}

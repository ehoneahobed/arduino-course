// ==================================================================
//   BAND 1, PART 7b  -  A FAULT WITH NO ERROR MESSAGE
//
//   WHAT IT DOES
//     Lights the red LED, then the yellow LED, then nothing.
//     The green LED never comes on.
//
//     It compiles with no error. It uploads with no error.
//     The wiring is correct.
//
//   WHAT TO DO
//     Find the fault BY READING. Do not touch the breadboard.
//     Compare the names at the top with what the third block uses.
//
//     Band 1 Part 7b has the answer if you are stuck.
//
//   WIRING
//     Same as b1_02.
// ==================================================================

int redPin = 9;
int yellowPin = 8;
int greenPin = 7;

void setup() {
  pinMode(redPin, OUTPUT);
  pinMode(yellowPin, OUTPUT);
  pinMode(greenPin, OUTPUT);
}

void loop() {
  digitalWrite(redPin, HIGH);
  delay(1000);
  digitalWrite(redPin, LOW);

  digitalWrite(yellowPin, HIGH);
  delay(1000);
  digitalWrite(yellowPin, LOW);

  digitalWrite(6, HIGH);
  delay(1000);
  digitalWrite(6, LOW);
}

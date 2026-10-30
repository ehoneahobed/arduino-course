// ==================================================================
//   BAND 0, PARTS 4 AND 6  -  YOUR FIRST SKETCH
//
//   WHAT IT DOES
//     Switches the small light marked L on the board on for one
//     second, off for one second, and repeats forever.
//
//   WIRING
//     None at all. That light is already built into the board.
//     You only need the USB cable.
//
//   BEFORE YOU UPLOAD IT
//     Read it first. Write down what you think it will do.
//     Band 0 Part 4 has the four questions to answer.
// ==================================================================

void setup() {
  pinMode(13, OUTPUT);
}

void loop() {
  digitalWrite(13, HIGH);
  delay(1000);
  digitalWrite(13, LOW);
  delay(1000);
}

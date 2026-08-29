// ==================================================================
//   BAND 2, PART 8b  -  ONE WRONG CHARACTER
//
//   WHAT IT DOES
//     It compiles. It uploads. The LED is wired correctly and it
//     does light up. But it will not fade. It snaps from off to on,
//     somewhere in the middle.
//
//   WHAT TO DO
//     One character in this file is wrong. Find it by reading.
//     Look at the very first line and then look at your board.
//
//     Band 2 Part 8b has the answer.
//
//   WIRING
//     Same as b2_02, the RGB build you already have on the board.
//     FIRST move the RED channel's wire, the one from h2, out of
//     pin 9 and into pin 7 instead. Leave green and blue alone.
//     When you have finished, move that wire back to pin 9 AND
//     change lampPin back to 9 in this file. Leave everything
//     else exactly as it was.
//
//     That move is part of the exercise. Band 2 Part 8b tells
//     you when to do it and why.
//
//   WHEN YOU HAVE FINISHED
//     Move the wire back to pin 9 AND change the 7 in the code
//     to a 9. You must do both. Change only one and the light
//     will not come on at all, because the code and the wire
//     will be pointing at different pins.
// ==================================================================

int lampPin = 7;

void setup() {
  pinMode(lampPin, OUTPUT);
}

void loop() {
  for (int level = 0; level <= 255; level = level + 4) {
    analogWrite(lampPin, level);
    delay(20);
  }
  for (int level = 255; level >= 0; level = level - 4) {
    analogWrite(lampPin, level);
    delay(20);
  }
}

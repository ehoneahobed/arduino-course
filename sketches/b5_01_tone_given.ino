// ==================================================================
//   BAND 5, PARTS 3 AND 4  -  MAKING NOTES
//
//   WHAT IT DOES
//     Plays three rising notes, then a pause, over and over.
//
//     Notice there is NO silence between the three notes.
//     tone replaces whatever was playing, immediately.
//
//   WIRING
//     Passive buzzer long leg b40, short leg b42.
//     Wire a40 to pin 12. Wire a42 to the minus rail.
//     One wire from the minus rail to a GND pin. No resistor.
//
//   WHICH BUZZER
//     You need the PASSIVE one, with a green circuit board
//     underneath. The active one, with a solid black cover, makes
//     one fixed beep whatever you do. It still works, you just
//     get one note instead of four.
// ==================================================================

int buzzerPin = 12;

void setup() {
  pinMode(buzzerPin, OUTPUT);
}

void loop() {
  tone(buzzerPin, 262);
  delay(400);

  tone(buzzerPin, 330);
  delay(400);

  tone(buzzerPin, 392);
  delay(400);

  noTone(buzzerPin);
  delay(1200);
}

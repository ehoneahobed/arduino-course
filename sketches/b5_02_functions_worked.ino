// ==================================================================
//   BAND 5, PARTS 4 AND 5  -  YOUR FIRST FUNCTION
//
//   WHAT IT DOES
//     Lights each of the four lights in turn, each with its own note.
//
//   WHAT IS NEW HERE
//     playStep is a function: a named group of instructions that
//     you wrote, which runs only when a line asks for it by name.
//
//     Without it, this sketch would be twenty nearly identical
//     lines. With it, it is four, and the 400 exists in one place.
//
//     Change the 400 inside playStep and all four steps change.
//     That is the whole point.
//
//   WIRING
//     Light 1  long b3,  short b4.  Resistor a3 to a1.   Wire b1 to pin 2.
//     Light 2  long b7,  short b8.  Resistor a7 to a5.   Wire b5 to pin 3.
//     Light 3  long b11, short b12. Resistor a11 to a9.  Wire b9 to pin 4.
//     Light 4  long b15, short b16. Resistor a15 to a13. Wire b13 to pin 5.
//
//     The pin wire goes in row b, not row a, because the resistor
//     leg is already in the row a hole and a hole takes ONE leg.
//     Every short leg to the minus rail. Buzzer as in b5_01.
//     One wire from the minus rail to a GND pin.
// ==================================================================

int ledPins[4] = {2, 3, 4, 5};
int notes[4] = {262, 330, 392, 523};
int buzzerPin = 12;

void playStep(int which) {
  digitalWrite(ledPins[which], HIGH);
  tone(buzzerPin, notes[which]);
  delay(400);

  digitalWrite(ledPins[which], LOW);
  noTone(buzzerPin);
  delay(120);
}

void setup() {
  for (int i = 0; i < 4; i = i + 1) {
    pinMode(ledPins[i], OUTPUT);
  }
  pinMode(buzzerPin, OUTPUT);
}

void loop() {
  playStep(0);
  playStep(1);
  playStep(2);
  playStep(3);

  delay(1000);
}

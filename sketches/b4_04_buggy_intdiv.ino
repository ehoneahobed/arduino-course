// ==================================================================
//   BAND 4, PART 9  -  WHY THE ANSWER IS ALWAYS ZERO
//
//   WHAT IT DOES
//     The reading changes as you turn the knob.
//     The volts stay at 0.00 forever.
//
//     Nothing is broken and the arithmetic is correct.
//
//   WHY
//     5 and 1023 are both whole numbers, so the board does
//     whole-number division. The real answer is about 0.00489.
//     There is nowhere to put the fraction, so it becomes 0.
//     Then it multiplies your reading by 0.
//
//   THE FIX
//     Put a decimal point on one of them:
//       float volts = 5.0 / 1023.0 * reading;
//     One decimal point anywhere in the division is enough.
//
//   WIRING
//     Knob as in b4_01.
// ==================================================================

int knobPin = A0;

void setup() {
  Serial.begin(9600);
}

void loop() {
  int reading = analogRead(knobPin);

  float volts = 5 / 1023 * reading;

  Serial.print("reading ");
  Serial.print(reading);
  Serial.print("   volts ");
  Serial.println(volts);

  delay(300);
}

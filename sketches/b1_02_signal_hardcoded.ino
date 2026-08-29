// ==================================================================
//   BAND 1, PART 6  -  THREE LIGHTS, WRITTEN THE LONG WAY
//
//   WHAT IT DOES
//     Runs a road crossing sequence on three LEDs:
//       red alone (5 s), red and yellow (1.5 s),
//       green alone (5 s), yellow alone (1.5 s), then repeats.
//
//   WIRING
//     Red    LED long leg f5,  short leg f6.  Resistor j5 to j3.  Wire j3 to pin 9.
//     Yellow LED long leg f10, short leg f11. Resistor j10 to j8. Wire j8 to pin 8.
//     Green  LED long leg f15, short leg f16. Resistor j15 to j13. Wire j13 to pin 7.
//     Wire from j6, j11 and j16 each to the minus rail.
//     ONE wire from the minus rail to a GND pin.
//
//   NOTICE
//     Each of the four blocks says what ALL THREE lights are doing,
//     even the ones that should be off. That is on purpose.
//     Band 1 Part 7d explains why.
// ==================================================================

void setup() {
  pinMode(9, OUTPUT);
  pinMode(8, OUTPUT);
  pinMode(7, OUTPUT);
}

void loop() {
  digitalWrite(9, HIGH);
  digitalWrite(8, LOW);
  digitalWrite(7, LOW);
  delay(5000);

  digitalWrite(9, HIGH);
  digitalWrite(8, HIGH);
  digitalWrite(7, LOW);
  delay(1500);

  digitalWrite(9, LOW);
  digitalWrite(8, LOW);
  digitalWrite(7, HIGH);
  delay(5000);

  digitalWrite(9, LOW);
  digitalWrite(8, HIGH);
  digitalWrite(7, LOW);
  delay(1500);
}

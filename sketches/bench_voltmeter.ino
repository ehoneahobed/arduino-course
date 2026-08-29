// ==================================================================
//   BENCH TOOL  -  THE BOARD AS A VOLTMETER
//
//   For use until the multimeters arrive, and afterwards whenever
//   one is not free. It reads the voltage on A0 and prints it.
//
//   WIRING, TWO WIRES
//     One wire from A0, with its other end LOOSE. That loose end
//       is your probe: touch it to whatever you want to measure.
//     One wire from a GND pin to the MINUS rail of your circuit.
//     That is all. The circuit you are measuring stays as it is.
//
//   HOW TO USE IT
//     Open the serial monitor at 9600. Touch the probe end to the
//     MINUS rail: it should read about 0.00. Touch it to the 5V
//     pin: about 5.00. Now touch it anywhere in your circuit.
//
//   IT MEASURES AGAINST GROUND, AND A MULTIMETER DOES NOT
//     A multimeter reads the difference BETWEEN ITS TWO PROBES,
//     wherever you put them. This reads the difference between the
//     probe and GROUND, because ground is the only thing the board
//     can compare against.
//
//     So to get the voltage ACROSS a part, measure both of its
//     ends and subtract:
//
//       across the LED = (reading at its long-leg column)
//                      - (reading at its short-leg column)
//
//     That is not a workaround. It is what a voltage IS: a
//     difference between two places, never a property of one.
//
//   *** NEVER TOUCH THE PROBE TO THE + RAIL AFTER BAND 6 ***
//     From Band 6 the + rail carries about SIX volts from the
//     battery pack. A0 is an Arduino pin and no Arduino pin may
//     ever see more than five. It damages the board quietly, with
//     nothing at all to tell you.
//
//     This tool is for five-volt circuits only. On the battery
//     side of a Band 6 build, use a real multimeter or do not
//     measure.
//
//   THREE THINGS IT CANNOT DO
//     It cannot measure CURRENT. Work that out with Ohm's law.
//     It cannot measure RESISTANCE. Read the colour stripes.
//     It cannot check its own ruler. It works out volts by
//       comparing against the board's own 5V supply, so if that
//       supply is really 4.8 then every reading is out by the
//       same four per cent and nothing here can tell you. A
//       multimeter has its own reference and can. That is the
//       honest reason to want one.
//
//   YOU WILL UNDERSTAND analogRead PROPERLY IN BAND 4.
//     For now, run it. Reading somebody else's working code
//     before you can write it is how every band here starts.
// ==================================================================

int probePin = A0;

void setup() {
  Serial.begin(9600);
  Serial.println("Voltmeter ready.");
  Serial.println("Probe wire in A0. GND wire to the minus rail.");
  Serial.println("raw   volts");
}

void loop() {
  int raw = analogRead(probePin);

  // 1023 is the biggest reading and it means the TOP of the five
  // volt range, not exactly five. So every step is 5 divided by
  // 1023, which is about five thousandths of a volt.
  float volts = raw * 5.0 / 1023.0;

  Serial.print(raw);
  Serial.print("   ");
  Serial.print(volts, 2);        // 2 means two decimal places
  Serial.println(" V");

  delay(500);
}

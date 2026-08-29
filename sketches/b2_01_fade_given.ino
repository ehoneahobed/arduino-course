// ==================================================================
//   BAND 2, PARTS 3 AND 5  -  A FADING LIGHT
//
//   WHAT IT DOES
//     Makes one LED grow slowly brighter, then slowly dimmer,
//     over and over. One full round takes about 2.5 seconds.
//
//   WIRING
//     LED long leg into hole f5, short leg into hole f6.
//     Resistor (220 ohm) from j5 to j3.
//     Wire from j3 to digital pin 9.
//     Wire from j6 to the minus rail.
//     Wire from the minus rail to a GND pin.
//
//     Pin 9 matters. Only pins 3, 5, 6, 9, 10 and 11 can fade,
//     and they are the ones with a ~ printed next to them.
//
//   WHAT IS NEW HERE
//     The word 'for'. It repeats the two lines inside it, counting
//     as it goes. Band 2 Part 4 explains it slowly, one piece at
//     a time. Read that before you try to change this.
// ==================================================================

int lampPin = 9;

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

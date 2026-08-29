// ==================================================================
//   BAND 4, PARTS 7 AND 8  -  READING THE LIGHT SENSOR
//
//   WHAT IT DOES
//     Prints the light level, five times a second.
//
//   WIRING
//     Light sensor legs into f12 and f14.
//     Wire j12 to the + rail.
//     Resistor 10 000 ohm (BROWN BLACK ORANGE) from j14 to j16.
//     Wire j16 to the minus rail.
//     Wire h14 to pin A1.
//
//     The 10 000 ohm resistor matters. A 220 ohm one here gives
//     almost no change and you will think the sensor is broken.
//
//   USE THIS FOR CALIBRATION
//     Band 4 Part 8 asks you to carry this to several real places
//     and write down what it reads in each. Do not skip that.
//     Nobody can tell you what number counts as dark. You measure it.
// ==================================================================

int lightPin = A1;

void setup() {
  Serial.begin(9600);
}

void loop() {
  int reading = analogRead(lightPin);
  Serial.println(reading);
  delay(200);
}

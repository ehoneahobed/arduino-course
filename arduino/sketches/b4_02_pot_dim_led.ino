// ==================================================================
//   BAND 4, PART 6  -  TURNING ONE RANGE INTO ANOTHER
//
//   WHAT IT DOES
//     The knob controls the brightness of a light, and the serial
//     monitor shows you both numbers so you can see map working.
//
//     The knob gives 0 to 1023. Brightness needs 0 to 255.
//     map does the conversion.
//
//   WIRING
//     Knob as in b4_01.
//     LED long leg f20, short leg f22.
//     Resistor from j20 to j18. Wire h18 to pin 9.
//     Wire j22 to the minus rail.
//
//   THINGS TO TRY
//     map(reading, 0, 1023, 255, 0)  reverses the knob direction.
//     map(reading, 0, 1023, 60, 120) squeezes it into a narrow band.
// ==================================================================

int knobPin = A0;
int lampPin = 9;

void setup() {
  pinMode(lampPin, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int reading = analogRead(knobPin);
  int brightness = map(reading, 0, 1023, 0, 255);

  analogWrite(lampPin, brightness);

  Serial.print("reading ");
  Serial.print(reading);
  Serial.print("   brightness ");
  Serial.println(brightness);

  delay(150);
}

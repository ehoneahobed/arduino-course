// ==================================================================
//   BAND 4, PARTS 4 AND 5  -  READING THE KNOB
//
//   WHAT IT DOES
//     Prints the knob position, five times a second, as a number
//     from 0 to 1023.
//
//   WIRING
//     Use the rails along ONE edge of the board for this whole band.
//     Wire the + rail to the 5V pin. Wire the minus rail to a GND pin.
//     CHECK THAT TWICE before you plug in.
//
//     Potentiometer legs into f5, f6 and f7.
//     Wire j5 to the + rail.
//     Wire j6 to pin A0.
//     Wire j7 to the minus rail.
//
//   NOTE
//     Analog pins need the capital A. Writing 0 instead of A0 reads
//     a completely different pin.
// ==================================================================

int knobPin = A0;

void setup() {
  Serial.begin(9600);
}

void loop() {
  int reading = analogRead(knobPin);
  Serial.println(reading);
  delay(200);
}

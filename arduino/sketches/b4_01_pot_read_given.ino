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
//     Write the capital A on analog pins, every time.
//     analogRead(0) happens to reach the same pin as
//     analogRead(A0), so this one forgives you. But pinMode,
//     digitalRead and digitalWrite do not: to them A0 means pin
//     14 and 0 means pin 0, which are two different pins on two
//     different edges of the board. Write the A and you never
//     have to remember which is which.
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

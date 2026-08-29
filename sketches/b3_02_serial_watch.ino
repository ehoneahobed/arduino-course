// ==================================================================
//   BAND 3, PARTS 3 AND 4  -  WATCH WHAT A PIN IS READING
//
//   WHAT IT DOES
//     Prints what the button pin is reading, five times a second,
//     to the serial monitor.
//
//   HOW TO SEE IT
//     Upload, then click Tools, then Serial Monitor.
//     Check the baud number in the corner says 9600.
//
//   WIRING
//     Just the button. See b3_01.
//
//   THE EXPERIMENT
//     Change INPUT_PULLUP to INPUT and upload again. Watch the
//     numbers jump about with nobody touching anything. That is a
//     floating pin. Then change it back.
//
//     You will also reuse this sketch to test each of the four
//     buttons before building the lock. Just change buttonPin.
// ==================================================================

int buttonPin = 2;

void setup() {
  Serial.begin(9600);
  pinMode(buttonPin, INPUT_PULLUP);
}

void loop() {
  int reading = digitalRead(buttonPin);
  Serial.println(reading);
  delay(200);
}

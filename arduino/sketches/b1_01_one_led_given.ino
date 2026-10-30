// ==================================================================
//   BAND 1, PARTS 4 AND 5  -  ONE LIGHT
//
//   WHAT IT DOES
//     Flashes one LED on for a short time and off for a longer time.
//
//   WIRING
//     LED long leg into hole f5, short leg into hole f6.
//     Resistor (220 ohm) from j5 to j3.
//     Wire from h3 to digital pin 8.
//     Wire from j6 to the minus rail.
//     Wire from the minus rail to a GND pin.
//
//   REMEMBER
//     Unplug the USB cable while you build. Plug it in after.
//     The LED only works one way round. Long leg towards the pin.
// ==================================================================

int lampPin = 8;

void setup() {
  pinMode(lampPin, OUTPUT);
}

void loop() {
  digitalWrite(lampPin, HIGH);
  delay(400);
  digitalWrite(lampPin, LOW);
  delay(1600);
}

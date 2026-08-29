// ==================================================================
//   BAND 3, PARTS 5 AND 6  -  A BUTTON THAT CONTROLS A LIGHT
//
//   WHAT IT DOES
//     The light is on while you hold the button down, and off
//     when you let go.
//
//   WIRING
//     Button pushed in across the middle channel, columns 1 and 3.
//     Wire from j1 to digital pin 2.
//     Wire from a3 to the minus rail. (Diagonal legs. See Part 2.)
//     LED long leg b18, short leg b20.
//     Resistor from a18 to a16. Wire a16 to pin 8. Wire a20 to the rail.
//     One wire from the minus rail to a GND pin.
//     No resistor for the button. INPUT_PULLUP uses the one in the chip.
//
//   REMEMBER
//     With INPUT_PULLUP: not pressed is 1, pressed is 0.
// ==================================================================

int buttonPin = 2;
int ledPin = 8;

void setup() {
  pinMode(buttonPin, INPUT_PULLUP);
  pinMode(ledPin, OUTPUT);
}

void loop() {
  if (digitalRead(buttonPin) == LOW) {
    digitalWrite(ledPin, HIGH);
  } else {
    digitalWrite(ledPin, LOW);
  }
}

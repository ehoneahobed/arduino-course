// ==================================================================
//   BAND 3, PART 8  -  THIS ONE DOES NOT WORK PROPERLY
//
//   WHAT IT SHOULD DO
//     Press once, light on. Press again, light off.
//
//   WHAT IT ACTUALLY DOES
//     Flickers madly while you hold the button, then lands on
//     whichever state it happened to be in. Useless.
//
//     The logic is correct. Nothing is misspelled. Work out why
//     before you look at the fixed version.
//
//     Hint: how many times a second does loop run?
//
//     Band 3 Part 9 explains it.
//
//   WIRING
//     Same as b3_01.
// ==================================================================

int buttonPin = 2;
int ledPin = 8;

bool lightIsOn = false;

void setup() {
  pinMode(buttonPin, INPUT_PULLUP);
  pinMode(ledPin, OUTPUT);
}

void loop() {
  if (digitalRead(buttonPin) == LOW) {

    if (lightIsOn == true) {
      lightIsOn = false;
    } else {
      lightIsOn = true;
    }

  }

  if (lightIsOn == true) {
    digitalWrite(ledPin, HIGH);
  } else {
    digitalWrite(ledPin, LOW);
  }
}

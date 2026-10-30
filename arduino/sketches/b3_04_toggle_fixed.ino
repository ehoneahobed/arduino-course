// ==================================================================
//   BAND 3, PART 9  -  THE FIXED VERSION
//
//   WHAT IT DOES
//     One press, one change. Every time, however long you hold it.
//
//   WHAT IS DIFFERENT
//     Three lines. Compare it with b3_03 line by line and find them.
//
//     1. It remembers what the button was doing last time.
//     2. It only acts when the button has JUST gone down.
//     3. It waits 50 ms afterwards, so the bounce inside the
//        button does not count as extra presses.
//
//   TRY BREAKING IT
//     Delete the line  lastReading = reading;  and upload.
//     Watch what happens, then put it back.
//
//   WIRING
//     Same as b3_01.
// ==================================================================

int buttonPin = 2;
int ledPin = 8;

bool lightIsOn = false;
int lastReading = HIGH;

void setup() {
  pinMode(buttonPin, INPUT_PULLUP);
  pinMode(ledPin, OUTPUT);
}

void loop() {
  int reading = digitalRead(buttonPin);

  if (reading == LOW && lastReading == HIGH) {

    if (lightIsOn == true) {
      lightIsOn = false;
    } else {
      lightIsOn = true;
    }

    delay(50);
  }

  lastReading = reading;

  if (lightIsOn == true) {
    digitalWrite(ledPin, HIGH);
  } else {
    digitalWrite(ledPin, LOW);
  }
}

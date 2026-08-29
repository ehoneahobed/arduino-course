// ==================================================================
//   BAND 3, PART 11  -  THE COMBINATION LOCK
//
//   WHAT IT DOES
//     Press four buttons. If they match the secret, the green light
//     comes on. If not, the red light and a double beep. Three
//     wrong tries in a row and it locks you out for ten seconds.
//
//     The secret is button 1, then 3, then 3, then 2.
//
//   WIRING
//     Button 1  columns 1 and 3    wire j1 to pin 2,  a3 to minus rail
//     Button 2  columns 5 and 7    wire j5 to pin 3,  a7 to minus rail
//     Button 3  columns 9 and 11   wire j9 to pin 4,  a11 to minus rail
//     Button 4  columns 13 and 15  wire j13 to pin 5, a15 to minus rail
//
//     Green LED long b18, short b20. Resistor a18 to a16.
//       Wire a16 to pin 8. Wire a20 to minus rail.
//     Red LED long b23, short b25. Resistor a23 to a21.
//       Wire a21 to pin 9. Wire a25 to minus rail.
//     Buzzer long b27, short b29. Wire a27 to pin 10.
//       Wire a29 to minus rail. No resistor.
//
//     One wire from the minus rail to a GND pin.
//
//   BUILD IT IN THREE STAGES AND TEST EACH ONE
//     Buttons first, then the lights, then the buzzer.
//     Do not wire all of it and hope.
//
//   OPEN THE SERIAL MONITOR
//     It tells you which button it heard and how many presses so far.
//
//   ONE DETAIL WORTH NOTICING
//     The test has three parts joined by &&, and the third is
//     pressCount < 4. Without it, a very fast fifth press could be
//     stored at entered[4], which is outside a list of four, and
//     the lock would jam for good. Band 3 Part 10 explains why
//     writing outside an array is so dangerous.
// ==================================================================

int buttonPins[4] = {2, 3, 4, 5};
int lastReading[4] = {HIGH, HIGH, HIGH, HIGH};

int secret[4] = {1, 3, 3, 2};
int entered[4] = {0, 0, 0, 0};
int pressCount = 0;

int greenPin = 8;
int redPin = 9;
int buzzerPin = 10;

int wrongTries = 0;

void setup() {
  for (int i = 0; i < 4; i = i + 1) {
    pinMode(buttonPins[i], INPUT_PULLUP);
  }
  pinMode(greenPin, OUTPUT);
  pinMode(redPin, OUTPUT);
  pinMode(buzzerPin, OUTPUT);

  Serial.begin(9600);
  Serial.println("Lock ready. Press four buttons.");
}

void loop() {

  for (int i = 0; i < 4; i = i + 1) {
    int reading = digitalRead(buttonPins[i]);

    if (reading == LOW && lastReading[i] == HIGH && pressCount < 4) {
      delay(50);

      entered[pressCount] = i + 1;
      pressCount = pressCount + 1;

      digitalWrite(buzzerPin, HIGH);
      delay(60);
      digitalWrite(buzzerPin, LOW);

      Serial.print("Button ");
      Serial.print(i + 1);
      Serial.print("   presses so far: ");
      Serial.println(pressCount);
    }

    lastReading[i] = reading;
  }

  if (pressCount == 4) {

    bool correct = true;
    for (int i = 0; i < 4; i = i + 1) {
      if (entered[i] != secret[i]) {
        correct = false;
      }
    }

    if (correct == true) {
      Serial.println("UNLOCKED");
      digitalWrite(greenPin, HIGH);
      digitalWrite(buzzerPin, HIGH);
      delay(400);
      digitalWrite(buzzerPin, LOW);
      delay(1600);
      digitalWrite(greenPin, LOW);
      wrongTries = 0;

    } else {
      Serial.println("WRONG");
      digitalWrite(redPin, HIGH);
      for (int i = 0; i < 2; i = i + 1) {
        digitalWrite(buzzerPin, HIGH);
        delay(250);
        digitalWrite(buzzerPin, LOW);
        delay(150);
      }
      delay(600);
      digitalWrite(redPin, LOW);
      wrongTries = wrongTries + 1;
    }

    if (wrongTries >= 3) {
      Serial.println("LOCKED OUT for 10 seconds");
      for (int i = 0; i < 10; i = i + 1) {
        digitalWrite(redPin, HIGH);
        delay(250);
        digitalWrite(redPin, LOW);
        delay(750);
      }
      wrongTries = 0;
      Serial.println("You may try again.");
    }

    pressCount = 0;
  }
}

// ==================================================================
//   BAND 8, PART 8  -  WATER TANK ALARM (WORKED EXAMPLE)
//
//   THE BRIEF THIS WAS BUILT FROM
//     "Our poly tank overflows at night because nobody sees it
//      filling. I want a warning while there is still time to
//      close the valve, loud enough to hear from the next room,
//      and I want to be able to shut it up without switching the
//      whole thing off."
//
//   THE CRITERIA, WRITTEN BEFORE ANY CODE
//     1. Warns when the water is within 15 cm of the top.
//     2. Warning is loud and visible, not one or the other.
//     3. One press quiets it for 30 seconds, then it warns again
//        if the water is still high.
//     4. Survives a power cut: it comes back armed by itself, with
//        nobody there to press anything.
//     5. Somebody who has never seen it can tell what it is doing
//        from across the room.
//
//   HOW IT MEASURES WATER WITHOUT A WATER SENSOR
//     The ultrasonic sensor from Band 7, pointed straight down at
//     the water from the top of the tank. Full tank means a SHORT
//     distance. That is how real tank sensors work.
//
//     Nothing touches the water. Nothing corrodes.
//
//   WIRING
//     HC-SR04 pins into f24, f25, f26, f27.
//       NOT f20 to f23, which is where Band 7 put it: the button
//       below sits in columns 19 and 21, and f21 would then hold
//       a sensor pin AND a button leg. One hole, one leg.
//       Wire j24 to the PLUS rail        (VCC)
//       Wire j25 to pin 10               (Trig)
//       Wire j26 to pin 11               (Echo)
//       Wire j27 to the MINUS rail       (GND)
//     One wire from the PLUS rail to the Arduino's 5V pin.
//     Green LED long b3, short b4. Resistor a3 to a1.
//       Wire b1 to pin 7. Wire a4 to minus rail.
//     Red LED long b7, short b8. Resistor a7 to a5.
//       Wire b5 to pin 8. Wire a8 to minus rail.
//     Buzzer long leg b40, short leg b42.
//       Wire a40 to pin 6. Wire a42 to minus rail. No resistor.
//     Button legs e19, e21, f19, f21. Wire j19 to pin 2,
//       wire a21 to the minus rail.
//     One wire from the minus rail to a GND pin.
//
//     ALL RAIL WIRES GO TO THE TOP PAIR, nearest row j. The
//     buzzer sits in rows a and b, so its minus wire is a long
//     one that runs round the end of the board. Top and bottom
//     rails are not joined to each other.
//
//   CRITERION 4, AND WHY IT IS THE INTERESTING ONE
//     There is no OFF state in this machine. setup() enters ARMED
//     directly. Cut the power and restore it and the device is
//     doing its job again with nobody present.
//
//     A device that needs a person to arm it after every power cut
//     is a device that is disarmed most of the time.
//
//   ONE MORE THING WORTH COPYING
//     alarmLevel is not written in three places. It is one number
//     at the top with a name. When you test this on a real tank
//     you WILL change it, and you want to change it once.
// ==================================================================

const int ARMED   = 0;
const int ALARM   = 1;
const int SNOOZED = 2;

int state = ARMED;

int trigPin = 10;
int echoPin = 11;
int greenPin = 7;
int redPin = 8;
int buzzerPin = 6;
int buttonPin = 2;

int alarmLevel = 15;          // cm from the sensor. Measure yours.
int clearLevel = 20;          // must fall below this to count as safe

unsigned long snoozeFor = 30000;
unsigned long stateSince = 0;

unsigned long lastFlash = 0;
bool flashOn = false;

int lastButton = HIGH;

long readDistance() {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  unsigned long microseconds = pulseIn(echoPin, HIGH, 25000);
  if (microseconds == 0) {
    return 999;               // no echo: treat as empty, never as full
  }
  return microseconds / 29 / 2;
}

bool buttonJustPressed() {
  int reading = digitalRead(buttonPin);
  bool pressed = (reading == LOW && lastButton == HIGH);
  lastButton = reading;
  if (pressed) delay(20);
  return pressed;
}

void enterState(int newState) {
  state = newState;
  stateSince = millis();

  noTone(buzzerPin);
  digitalWrite(redPin, LOW);
  digitalWrite(greenPin, LOW);

  if (state == ARMED)   digitalWrite(greenPin, HIGH);
  if (state == SNOOZED) digitalWrite(greenPin, HIGH);

  Serial.print("state ");
  Serial.println(state);
}

void runArmed(long cm, bool pressed) {
  if (cm <= alarmLevel) {
    enterState(ALARM);
  }
}

void runAlarm(long cm, bool pressed) {
  unsigned long now = millis();
  if (now - lastFlash >= 250) {
    lastFlash = now;
    flashOn = !flashOn;
    digitalWrite(redPin, flashOn ? HIGH : LOW);
    if (flashOn) {
      tone(buzzerPin, 1000);
    } else {
      noTone(buzzerPin);
    }
  }

  // Two different numbers on the way up and the way down, so a
  // reading that wobbles around 15 does not start and stop the
  // alarm twenty times a second.
  // else if, not two separate ifs. A press landing on the same
  // round as the water clearing must cause ONE change of state,
  // not two. With two ifs the device ends up snoozed for thirty
  // seconds when it should have gone straight back to armed.
  // b8_01 makes exactly this point; here is where it bites.
  if (cm >= clearLevel) {
    enterState(ARMED);
  }
  else if (pressed) {
    enterState(SNOOZED);
  }
}

void runSnoozed(long cm, bool pressed) {
  if (millis() - stateSince >= snoozeFor) {
    enterState(ARMED);
  }
}

void setup() {
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  pinMode(greenPin, OUTPUT);
  pinMode(redPin, OUTPUT);
  pinMode(buzzerPin, OUTPUT);
  pinMode(buttonPin, INPUT_PULLUP);
  Serial.begin(9600);

  enterState(ARMED);          // criterion 4: armed with nobody present
}

void loop() {
  long cm = readDistance();
  bool pressed = buttonJustPressed();

  if      (state == ARMED)   runArmed(cm, pressed);
  else if (state == ALARM)   runAlarm(cm, pressed);
  else if (state == SNOOZED) runSnoozed(cm, pressed);

  delay(50);
}

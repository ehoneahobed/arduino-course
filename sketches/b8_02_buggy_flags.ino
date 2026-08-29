// ==================================================================
//   BAND 8, PART 4  -  THE SAME DEVICE, WRITTEN THE OTHER WAY
//
//   THIS ONE GETS STUCK ON PURPOSE.
//
//   WHAT IT SHOULD DO
//     Exactly what b8_01 does. Four behaviours, one button.
//
//   WHAT IT ACTUALLY DOES
//     The first two presses look right. The third breaks it, in
//     two ways at once, and neither ever heals.
//
//     ONE. The light FREEZES. Not on, not off, not flashing:
//     stuck at whatever it happened to be at that instant, for
//     the whole five seconds. Nothing on the board is broken.
//     Nothing is even running: no branch below matches, so no
//     line touches the light at all.
//
//     TWO. Once it has alarmed once, it can NEVER go back to a
//     steady light. Snooze always lands it back in flashing.
//     Press it all day. You cannot get ARMED again.
//
//   WHY
//     Three true-or-false names instead of one state name.
//
//       armed    alarming   snoozed
//
//     Three of those means EIGHT combinations. Only four of the
//     eight make sense. Nothing stops the other four happening,
//     and nothing warns you when they do.
//
//     The third press produces armed=false with alarming=true:
//     alarming while not armed. Read the three branches at the
//     bottom of this file and check for yourself. Not one of them
//     matches that combination, so the light is simply never
//     written to.
//
//   TRY IT AND WATCH THE SERIAL MONITOR
//     It prints the three names after every press. Press three
//     times and read the third line. That combination is the bug,
//     and you can see it before you see the light misbehave.
//
//   THE THING TO SEE
//     Nothing here is badly typed. Every line is reasonable on its
//     own. The fault is in the SHAPE, and no amount of careful
//     typing fixes a shape.
//
//     One name with four values cannot reach a fifth. Three names
//     with two values each reach eight, and you have to defend
//     every one of them by hand.
//
//   WIRING
//     Same as b8_01.
// ==================================================================

bool armed = false;
bool alarming = false;
bool snoozed = false;

int ledPin = 7;
int buttonPin = 2;
int lastButton = HIGH;

unsigned long snoozeStart = 0;
unsigned long lastFlash = 0;
bool flashOn = false;

void setup() {
  pinMode(ledPin, OUTPUT);
  pinMode(buttonPin, INPUT_PULLUP);
  Serial.begin(9600);
}

void loop() {
  int reading = digitalRead(buttonPin);
  bool pressed = (reading == LOW && lastButton == HIGH);
  lastButton = reading;
  if (pressed) delay(20);

  if (pressed) {
    if (!armed) {
      armed = true;
    } else if (!alarming) {
      alarming = true;
    } else if (!snoozed) {
      snoozed = true;
      snoozeStart = millis();
      armed = false;             // <-- here it is
    } else {
      snoozed = false;
      alarming = false;
    }

    Serial.print("armed=");    Serial.print(armed);
    Serial.print("  alarming="); Serial.print(alarming);
    Serial.print("  snoozed=");  Serial.println(snoozed);
  }

  if (snoozed && millis() - snoozeStart >= 5000) {
    snoozed = false;
    armed = true;
  }

  if (armed && !alarming && !snoozed) {
    digitalWrite(ledPin, HIGH);
  } else if (armed && alarming) {
    unsigned long now = millis();
    if (now - lastFlash >= 120) {
      lastFlash = now;
      flashOn = !flashOn;
      digitalWrite(ledPin, flashOn ? HIGH : LOW);
    }
  } else if (!armed && !alarming) {
    digitalWrite(ledPin, LOW);
  }
  // If armed is false while alarming is true, NONE of the three
  // branches above runs, so nothing writes to the light and it
  // stays exactly as it was. That is the freeze.
}

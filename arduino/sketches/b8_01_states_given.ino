// ==================================================================
//   BAND 8, PART 3  -  ONE THING AT A TIME
//
//   WHAT IT DOES
//     A light with four behaviours and one button.
//       WAITING   light off
//       ARMED     light on steady
//       ALARM     light flashing fast
//       SNOOZED   light off for five seconds, then back to ARMED
//
//     Press the button to move on to the next behaviour. From
//     SNOOZED it moves on by itself when the five seconds are up.
//
//   WIRING
//     LED long leg b3, short leg b4.
//       Resistor a3 to a1. Wire b1 to pin 7. Wire a4 to minus rail.
//     Button legs in e19, e21, f19, f21.
//       Wire j19 to pin 2. Wire a21 to the minus rail.
//     One wire from the minus rail to a GND pin.
//
//   THE IDEA, AND IT IS THE WHOLE BAND
//     One name, state, holds what the device is doing right now.
//     It is ALWAYS exactly one of four values. Never two. Never
//     none.
//
//     Everything else follows from that:
//       - loop() asks what state we are in, and does that job.
//       - Changing behaviour means changing ONE name.
//       - A behaviour you did not plan for cannot happen, because
//         there is no fifth value.
//
//   WHY THE NAMES IN CAPITALS
//     WAITING, ARMED, ALARM and SNOOZED are just the numbers 0, 1,
//     2 and 3 with readable names. The board does not care. You
//     do, in six months, when you read this again.
//
//   THE PART WORTH COPYING
//     enterState() is the only place that changes state. Anything
//     that has to happen the MOMENT a state begins goes in there,
//     once, rather than being repeated in three places.
// ==================================================================

const int WAITING = 0;
const int ARMED   = 1;
const int ALARM   = 2;
const int SNOOZED = 3;

int state = WAITING;

int ledPin = 7;
int buttonPin = 2;

int lastButton = HIGH;

unsigned long stateSince = 0;      // when the current state began
unsigned long snoozeFor = 5000;

unsigned long lastFlash = 0;
bool flashOn = false;

// The ONLY place state ever changes.
void enterState(int newState) {
  state = newState;
  stateSince = millis();

  if (state == WAITING) digitalWrite(ledPin, LOW);
  if (state == ARMED)   digitalWrite(ledPin, HIGH);
  if (state == SNOOZED) digitalWrite(ledPin, LOW);

  Serial.print("now in state ");
  Serial.println(state);
}

// True only on the round where the button goes down.
bool buttonJustPressed() {
  int reading = digitalRead(buttonPin);
  bool pressed = (reading == LOW && lastButton == HIGH);
  lastButton = reading;
  if (pressed) delay(20);
  return pressed;
}

void runWaiting(bool pressed) {
  if (pressed) enterState(ARMED);
}

void runArmed(bool pressed) {
  if (pressed) enterState(ALARM);
}

void runAlarm(bool pressed) {
  unsigned long now = millis();
  if (now - lastFlash >= 120) {
    lastFlash = now;
    flashOn = !flashOn;
    digitalWrite(ledPin, flashOn ? HIGH : LOW);
  }
  if (pressed) enterState(SNOOZED);
}

void runSnoozed(bool pressed) {
  // else if, not two separate ifs: a press landing on the same
  // round as the timeout must cause ONE change of state, not two.
  if (millis() - stateSince >= snoozeFor) {
    enterState(ARMED);
  } else if (pressed) {
    enterState(WAITING);
  }
}

void setup() {
  pinMode(ledPin, OUTPUT);
  pinMode(buttonPin, INPUT_PULLUP);
  Serial.begin(9600);
  enterState(WAITING);
}

void loop() {
  bool pressed = buttonJustPressed();

  if      (state == WAITING) runWaiting(pressed);
  else if (state == ARMED)   runArmed(pressed);
  else if (state == ALARM)   runAlarm(pressed);
  else if (state == SNOOZED) runSnoozed(pressed);
}

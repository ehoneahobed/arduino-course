// ==================================================================
//   BAND 5 SWAP  -  REACTION RACE
//   Build this INSTEAD of Simon Says if four buttons and four
//   lights is more wiring than you want to fight with today.
//
//   It teaches every idea Band 5 teaches: your own functions,
//   values handed in and answers handed back, tone, random, and
//   millis instead of delay. With one light and one button.
//
//   WHAT IT DOES
//     The light comes on after a random wait of two to six seconds.
//     Press the button as fast as you can. It prints your time in
//     thousandths of a second, and it keeps your best.
//
//     Press too early and it says so and starts again. Catching
//     that is the interesting part of the sketch.
//
//   WIRING
//     LED long leg b3, short leg b4.
//       Resistor a3 to a1. Wire b1 to pin 7. Wire a4 to minus rail.
//     Button legs in e19, e21, f19, f21.
//       Wire j19 to pin 2. Wire a21 to the minus rail.
//     Buzzer long leg to pin 8, short leg to the minus rail.
//     One wire from the minus rail to a GND pin.
//
//   IF YOUR BUZZER IS THE ACTIVE KIND
//     Run id_01_which_buzzer.ino first if you are not sure.
//     With an active buzzer, tone() cannot change the pitch, so the
//     two sounds below come out the same. The game is unaffected.
//     If you would rather it were silent, delete the two beep lines.
//
//   THE HONEST NUMBER
//     A good human reaction to a light is about 200 to 350
//     thousandths of a second. Under 150 means you guessed rather
//     than reacted, and the sketch cannot tell the difference. Only
//     you know. Write down your real best, not your luckiest.
// ==================================================================

int ledPin = 7;
int buttonPin = 2;
int buzzerPin = 8;

unsigned long best = 0;          // 0 means "no score yet"

bool isPressed() {
  return digitalRead(buttonPin) == LOW;
}

// Wait for the button to be let go, so one press cannot count twice.
void waitForRelease() {
  while (isPressed()) {
    delay(5);
  }
  delay(20);
}

void beep(int pitch, int howLong) {
  tone(buzzerPin, pitch);
  delay(howLong);
  noTone(buzzerPin);
}

// Waits a random time. Hands back false if the player pressed
// during the wait, which is cheating and has to be caught.
// NOTE THE SUBTRACTION. Band 5 Part 7 made a point of writing
// millis() - startedAt < howLong rather than millis() < startedAt
// + howLong, and this is the same rule. The adding version breaks
// once every fifty days when millis wraps back round to zero, and
// it breaks by ending the wait instantly. Use the subtraction
// everywhere, every time, and you never have to think about it.
bool waitWithoutCheating(unsigned long howLong) {
  unsigned long startedAt = millis();
  while (millis() - startedAt < howLong) {
    if (isPressed()) {
      return false;
    }
  }
  return true;
}

// Times one press. Hands back the time in milliseconds, or 0 if
// nobody pressed within ten seconds, so that a badly wired button
// does not leave the board sitting there looking dead.
unsigned long timeOnePress() {
  unsigned long startedAt = millis();
  while (!isPressed()) {
    if (millis() - startedAt > 10000) {
      return 0;
    }
  }
  return millis() - startedAt;
}

void setup() {
  pinMode(ledPin, OUTPUT);
  pinMode(buzzerPin, OUTPUT);
  pinMode(buttonPin, INPUT_PULLUP);
  Serial.begin(9600);
  randomSeed(analogRead(A0));      // A0 must have nothing wired to it
  Serial.println("Reaction race. Wait for the light, then press.");
}

void loop() {
  digitalWrite(ledPin, LOW);
  Serial.println();
  Serial.println("Get ready...");
  delay(1000);

  unsigned long wait = random(2000, 6000);
  Serial.print("  wait ");
  Serial.println(wait);          // Part d asks you to read these

  if (!waitWithoutCheating(wait)) {
    Serial.println("Too early. You pressed before the light.");
    beep(180, 400);
    waitForRelease();
    return;                        // start the round again
  }

  digitalWrite(ledPin, HIGH);
  unsigned long took = timeOnePress();
  digitalWrite(ledPin, LOW);

  if (took == 0) {
    Serial.println("  No press seen in ten seconds.");
    Serial.println("  Test the button on its own with b3_02_serial_watch.ino.");
    delay(1500);
    return;
  }

  Serial.print("  ");
  Serial.print(took);
  Serial.println(" thousandths of a second");

  if (best == 0 || took < best) {
    best = took;
    Serial.println("  NEW BEST");
    beep(880, 150);
    beep(1320, 250);
  } else {
    Serial.print("  best so far ");
    Serial.println(best);
    beep(660, 150);
  }

  waitForRelease();
  delay(1200);
}

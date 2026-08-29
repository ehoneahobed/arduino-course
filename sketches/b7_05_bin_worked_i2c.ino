// ==================================================================
//   BAND 7, PART 8  -  THE PARKING GUARD (WORKED EXAMPLE)
//   For screens WITH an I2C board on the back. Four wires.
//   If yours has sixteen bare pins, use b7_05_bin_worked_parallel.
//
//   WHAT IT DOES
//     Measures how far away you are and reports it three ways at
//     once: the number on the screen, a word saying what to do,
//     and a beep that gets faster the closer you come.
//
//     Under 10 cm the beep becomes one solid tone. Stop.
//
//   WIRING
//     HC-SR04: VCC 5V, Trig pin 10, Echo pin 11, GND GND.
//     Screen : GND GND, VCC 5V, SDA A4, SCL A5.
//     Buzzer : long leg to pin 6, short leg to the minus rail.
//     One wire from the minus rail to a GND pin.
//
//   THE FOUR IDEAS IN HERE
//     1. The screen is only written when something CHANGED.
//        Nothing flickers, because nothing is redrawn for nothing.
//     2. Short text is padded with spaces to a fixed width, so
//        going from 100 to 99 does not leave an old digit behind.
//     3. The beeping uses millis(), so measuring never stops while
//        a beep is on. Band 5 again, in a new place.
//     4. Every job has a name. loop() is four lines and reads like
//        a description of the device.
//
//   THE ONE RULE ABOUT THE SENSOR
//     A reading of 0 means "no echo came back", not "you are
//     touching it". Treat 0 as out of range, or your guard will
//     scream at an empty room.
// ==================================================================

#include <Wire.h>
#include <LiquidCrystal_I2C.h>

LiquidCrystal_I2C screen(0x27, 16, 2);

int trigPin = 10;
int echoPin = 11;
int buzzerPin = 6;

long lastShown = -1;            // what the screen currently says
unsigned long lastBeep = 0;     // when the last beep started
bool beeping = false;

// --- measuring -----------------------------------------------------
long readDistance() {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  unsigned long microseconds = pulseIn(echoPin, HIGH, 25000);
  if (microseconds == 0) {
    return 999;                 // nothing heard: treat as far away
  }
  return microseconds / 29 / 2;
}

// --- what to call each distance ------------------------------------
// Every one of these is EXACTLY 16 characters long, so writing one
// fills the whole row and cannot leave the last one showing.
const char* wordFor(long cm) {
  if (cm < 10)  return "STOP            ";
  if (cm < 30)  return "Nearly there    ";
  if (cm < 100) return "Keep coming     ";
  return "Clear           ";
}

// How long between beeps. Smaller number, faster beeping.
int gapFor(long cm) {
  if (cm < 10)  return 0;       // 0 means one solid tone
  if (cm < 30)  return 120;
  if (cm < 60)  return 350;
  if (cm < 100) return 800;
  return -1;                    // -1 means silent
}

// --- the screen ----------------------------------------------------
// Only ever writes when the number actually changed, and always
// writes the same number of characters, so nothing is left behind.
void showDistance(long cm) {
  if (cm == lastShown) {
    return;
  }
  lastShown = cm;

  screen.setCursor(0, 0);
  screen.print(wordFor(cm));

  screen.setCursor(0, 1);
  // Always send EXACTLY 16 characters, whatever the number is.
  // The number itself is made 3 wide by putting spaces in front of
  // it, so 7 prints as "  7" and 742 prints as "742". Then " cm"
  // and ten more spaces make 16 every single time.
  if (cm >= 999) {
    screen.print("--- cm          ");     // 16 characters
  } else {
    if (cm < 100) screen.print(" ");
    if (cm < 10)  screen.print(" ");
    screen.print(cm);
    screen.print(" cm          ");        // 3 + 13 = 16
  }
}

// --- the buzzer ----------------------------------------------------
void updateBeep(long cm) {
  int gap = gapFor(cm);

  if (gap < 0) {                       // silent
    noTone(buzzerPin);
    beeping = false;
    return;
  }

  if (gap == 0) {                      // solid tone
    tone(buzzerPin, 880);
    beeping = true;
    return;
  }

  unsigned long now = millis();
  if (now - lastBeep >= (unsigned long)gap) {
    lastBeep = now;
    if (beeping) {
      noTone(buzzerPin);
      beeping = false;
    } else {
      tone(buzzerPin, 660);
      beeping = true;
    }
  }
}

void setup() {
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  pinMode(buzzerPin, OUTPUT);

  screen.init();
  screen.backlight();
  screen.setCursor(0, 0);
  screen.print("Parking guard");
  delay(1000);
  screen.clear();                      // once, at the start, is fine
}

void loop() {
  long cm = readDistance();
  showDistance(cm);
  updateBeep(cm);
  delay(50);
}

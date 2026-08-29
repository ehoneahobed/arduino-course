// ==================================================================
//   BAND 7, PART 7  -  THIS ONE FLICKERS ON PURPOSE
//
//   WHAT IT SHOULD DO
//     Show the distance on the screen and keep it up to date.
//
//   WHAT IT ACTUALLY DOES
//     The number is there, but the screen flickers so hard it is
//     unpleasant to look at and hard to read.
//
//   WHY
//     Two separate mistakes, and they add up.
//
//     ONE. clear() wipes all 32 character positions and takes
//     about 2 milliseconds. Doing it every round means the screen
//     is blank a good part of the time. Your eye sees that.
//
//     TWO. It rewrites the number even when the number has not
//     changed. Nothing on the screen needed to change, and it
//     changed anyway.
//
//   THE ONE THAT CATCHES EVERYBODY
//     Stop using clear() and a new problem appears. Go from 100 cm
//     down to 99 and the screen reads "990". The old third
//     character is still sitting there.
//
//     A screen never wipes itself. If your new text is shorter
//     than the old text, the leftovers stay. b7_05 shows the fix,
//     and it is not clear().
//
//   WIRING
//     Sensor as in b7_01, with Echo on pin 11.
//     Screen as in b7_02. THIS FILE IS FOR THE I2C SCREEN ONLY.
//
//     If you have a bare 16-pin screen, read Band 7 Part 7 rather
//     than running this. Your screen needs pin 11, which the
//     sensor is using here, and two wires do not fit in one pin.
// ==================================================================

#include <Wire.h>
#include <LiquidCrystal_I2C.h>

LiquidCrystal_I2C screen(0x27, 16, 2);

int trigPin = 10;
int echoPin = 11;

long readDistance() {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  unsigned long microseconds = pulseIn(echoPin, HIGH, 25000);
  return microseconds / 29 / 2;
}

void setup() {
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  screen.init();
  screen.backlight();
}

void loop() {
  long cm = readDistance();

  screen.clear();                 // <- wipes everything, every round
  screen.setCursor(0, 0);
  screen.print("Distance");
  screen.setCursor(0, 1);
  screen.print(cm);               // <- rewritten even when unchanged
  screen.print(" cm");

  delay(60);
}

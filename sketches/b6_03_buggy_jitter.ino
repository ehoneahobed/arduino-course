// ==================================================================
//   BAND 6, PART 6  -  THIS ONE TWITCHES ON PURPOSE
//
//   WHAT IT SHOULD DO
//     Hold the arm still wherever the knob is set.
//
//   WHAT IT ACTUALLY DOES
//     The arm never settles. Take your hand right off the knob
//     and the horn still buzzes and shivers.
//
//   WHY
//     analogRead never returns quite the same number twice. Leave
//     the knob alone and you still get 511, 512, 511, 513, 512.
//     That is normal and it is not a fault.
//
//     map() turns those into 89, 90, 89, 90, 90.
//
//     Then you hand every one of them to the servo. A servo asked
//     for a new position twenty times a second will try to reach
//     every one of them, and what you hear is the motor starting
//     and stopping, starting and stopping.
//
//     THE READING IS NOT WRONG. THE PROBLEM IS THAT YOU ACT ON
//     EVERY SINGLE ONE OF THEM.
//
//   THE FIX IS IN b6_04
//     Only move when the new angle is far enough from the last one
//     to be worth moving for. That gap is called a DEADBAND.
//
//   WIRING
//     Same as b6_02.
// ==================================================================

#include <Servo.h>

Servo gate;
int servoPin = 9;
int knobPin = A0;

void setup() {
  gate.attach(servoPin);
}

void loop() {
  int reading = analogRead(knobPin);
  int angle = map(reading, 0, 1023, 0, 180);

  gate.write(angle);   // every single time, whether it changed or not

  delay(20);
}

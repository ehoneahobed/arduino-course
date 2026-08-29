// ==================================================================
//   BAND 6, PART 3  -  YOUR FIRST MOVING THING
//
//   WHAT IT DOES
//     The servo horn turns slowly from one end to the other, then
//     slowly back, over and over.
//
//   WIRING
//     Servo brown or black wire  ->  GND on the Arduino
//     Servo red wire             ->  5V on the Arduino
//     Servo orange or yellow     ->  pin 9
//
//     Nothing else on the board. No breadboard needed yet.
//
//     ONE SERVO, MOVING NOTHING, IS FINE ON THE 5V PIN. As soon as
//     it has to push something, it is not. Band 6 Part 7 tells you
//     what to do about that and why.
//
//   WHAT IS NEW HERE
//     #include <Servo.h> at the top. That line brings in code
//     somebody else wrote so you do not have to. Without it the
//     word Servo means nothing and the sketch will not compile.
//
//     Servo gate; makes YOUR servo, and you named it gate.
//     gate.attach(9) tells it which pin the signal wire is on.
//     gate.write(90) sends it to 90 degrees.
//
//   READ THIS BEFORE YOU CHANGE ANYTHING
//     write() takes an ANGLE, not a speed. The servo goes there
//     as fast as it can and then holds. The slow sweep you see is
//     you sending a long list of angles one degree apart, with a
//     small wait between each.
// ==================================================================

#include <Servo.h>

Servo gate;
int servoPin = 9;

void setup() {
  gate.attach(servoPin);
}

void loop() {
  // 0 degrees up to 180, one degree at a time
  for (int angle = 0; angle <= 180; angle = angle + 1) {
    gate.write(angle);
    delay(15);
  }

  // and back down again
  for (int angle = 180; angle >= 0; angle = angle - 1) {
    gate.write(angle);
    delay(15);
  }
}

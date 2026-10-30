// ==================================================================
//   BAND 6, PART 5  -  THE KNOB DRIVES THE ARM
//
//   WHAT IT DOES
//     The servo horn copies the knob. Turn the knob left, the arm
//     goes left. Turn it right, the arm follows.
//
//   WIRING
//     Servo brown/black -> GND,  red -> 5V,  orange/yellow -> pin 9
//
//     Potentiometer, the same one from Band 4:
//       left leg   f5   wire j5 to the minus rail
//       middle leg f6   wire j6 to pin A0
//       right leg  f7   wire j7 to the plus rail
//     Wire the plus rail to 5V and the minus rail to GND.
//
//     IN THIS PART the plus rail is the ARDUINO's 5V. From Part 7
//     onwards it becomes BATTERY power, about six volts, and the
//     knob must NOT be on it. See b6_04's header.
//
//   THE ONE IDEA
//     analogRead gives 0 to 1023. write() wants 0 to 180. map()
//     does that conversion, exactly as it did for brightness in
//     Band 4. Nothing here is new except what is on the end of it.
//
//   WATCH FOR
//     The horn may buzz quietly even when your hand is off the
//     knob. That is not a fault in your wiring. Band 6 Part 6 is
//     about why, and what to do.
// ==================================================================

#include <Servo.h>

Servo gate;
int servoPin = 9;
int knobPin = A0;

void setup() {
  gate.attach(servoPin);
  Serial.begin(9600);
}

void loop() {
  int reading = analogRead(knobPin);
  int angle = map(reading, 0, 1023, 0, 180);

  gate.write(angle);

  Serial.print("reading ");
  Serial.print(reading);
  Serial.print("   angle ");
  Serial.println(angle);

  delay(20);
}

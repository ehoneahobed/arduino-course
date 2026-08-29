// ==================================================================
//   BAND 6 SWAP  -  A FAN ON A TRANSISTOR
//   Build this INSTEAD of the servo gate, or as well as it.
//
//   WHAT IT DOES
//     A small motor whose speed follows the knob, with a light that
//     shows when it is running. Press the button and it runs flat
//     out for three seconds, then goes back to the knob.
//
//   WHAT IS DIFFERENT FROM THE SERVO
//     A servo is told WHERE to be. A motor is told HOW FAST to go
//     and never stops anywhere in particular. Two completely
//     different jobs, and picking the wrong one is a common way to
//     waste an afternoon.
//
//   WHY YOU CANNOT PUT THE MOTOR STRAIGHT ON A PIN
//     An Arduino pin can give about 20 thousandths of an amp before
//     it is damaged. This motor wants ten to twenty times that when
//     it starts. Wire it to a pin and you are not driving a motor,
//     you are breaking a chip, slowly, without being told.
//
//     A TRANSISTOR is a switch that a tiny current operates and a
//     big current goes through. The pin gives the order. The
//     battery does the work. They never meet.
//
//   WHICH TRANSISTOR, AND WHICH WAY ROUND
//     Read the number printed on the flat face. It matters twice.
//
//     LEG ORDER, holding it with the FLAT FACE TOWARDS YOU and the
//     legs pointing DOWN, reading left to right:
//
//       S8050, 2N2222, PN2222   ->  EMITTER  BASE  COLLECTOR
//       BC547, BC548            ->  COLLECTOR  BASE  EMITTER
//
//     THOSE TWO ARE OPPOSITE. Get it wrong and the battery pushes
//     backwards through the transistor and damages it for good.
//     If your number is not in that list, search for it plus the
//     word pinout and check a picture BEFORE you connect anything.
//
//     SIZE. A BC547 can only carry 100 thousandths of an amp, and
//     a starting motor wants two to four times that. Use an S8050
//     or a 2N2222 if you have one. A BC547 will run warm and may
//     not survive; it is not the part for this job.
//
//       BASE      -> a 220 ohm resistor -> Arduino pin 5
//       EMITTER   -> the MINUS rail
//       COLLECTOR -> one motor wire
//       Other motor wire -> the PLUS rail
//
//     WHY 220 AND NOT 1k. The transistor needs roughly a tenth of
//     the motor's current fed into its base to switch fully on.
//     220 ohms gives about 19 thousandths of an amp, which is
//     right at what one Arduino pin can supply. A 1k resistor
//     gives about 4, the transistor never switches fully on, and
//     it gets hot while the motor stays weak.
//
//   *** THE DIODE IS NOT OPTIONAL ***
//     A 1N4001 (or any 1N400x, or a 1N4148) goes ACROSS THE MOTOR:
//       stripe end   -> the PLUS rail
//       other end    -> the collector
//
//     A spinning motor that is switched off becomes a generator
//     for an instant and pushes a high voltage backwards. PWM
//     switches it off about a THOUSAND TIMES A SECOND, so this
//     happens a thousand times a second. The diode gives that
//     spike a harmless way round. Without it you are slowly
//     destroying the transistor, and possibly the Arduino.
//
//     THE STRIPE MUST FACE THE PLUS RAIL. A diode the wrong way
//     round is a short circuit across your battery.
//
//   IF YOU HAVE NO DIODE, OR ONLY A BC547 / BC548
//     Do not run this build with a bare transistor. Use the
//     ULN2003 stepper driver board instead: it has seven
//     transistors AND all seven of their diodes already inside.
//     Nothing in this sketch changes.
//
//       Arduino pin 5      -> IN1
//       the board's MINUS  -> the MINUS rail
//       the board's PLUS   -> the PLUS rail   <- NOT optional.
//                             Without it the diodes inside the
//                             board have nowhere to send the
//                             spike, and you have gained nothing.
//       one motor wire     -> OUT1
//       other motor wire   -> the PLUS rail
//
//     SOME OF THESE BOARDS HAVE NO PIN MARKED OUT1. If yours has
//     only the white five-pin socket, the outputs are in that
//     socket: push a jumper wire into the socket hole at the end
//     FURTHEST from the IN pins and use that as OUT1.
//
//     The project page explains what you gain and lose here.
//
//     Battery pack red to PLUS rail, black to MINUS rail.
//     ONE wire from the MINUS rail to an Arduino GND pin.
//     Shared ground again. Band 6 Part 7. Same rule, same reason.
//
//     LED long leg b3, short leg b4.
//       Resistor a3 to a1, wire b1 to pin 7, wire a4 to MINUS rail.
//     Button legs e19, e21, f19, f21.
//       wire j19 to pin 2, wire a21 to MINUS rail.
//     Potentiometer legs f5, f6, f7.
//       wire j5 to MINUS rail, j6 to A0,
//       j7 STRAIGHT TO THE ARDUINO'S 5V PIN, not the + rail.
//
//   PIN 5 MATTERS
//     It has a ~ next to it. Speed is PWM, exactly like brightness
//     in Band 2. On a pin without a ~ you get off and full and
//     nothing in between.
//
//   THE MOTOR WILL NOT START AT LOW NUMBERS
//     Below about 60 there is not enough push to overcome friction,
//     so it sits there humming. That is not a fault. It is why
//     minSpeed exists below, and finding your own value for it is
//     part of the build.
// ==================================================================

int motorPin = 5;      // must be a ~ pin
int knobPin = A0;
int ledPin = 7;
int buttonPin = 2;

int minSpeed = 60;     // below this the motor hums and does not turn
int burstFor = 3000;
int deadband = 6;      // ignore speed changes smaller than this

unsigned long burstUntil = 0;
int lastButton = HIGH;
int lastSpeed = -100;  // impossible on purpose, so the first read acts

bool buttonJustPressed() {
  int reading = digitalRead(buttonPin);
  bool pressed = (reading == LOW && lastButton == HIGH);
  lastButton = reading;
  if (pressed) delay(20);
  return pressed;
}

// Turn a knob reading into a speed, with a dead zone at the bottom
// so that "off" really is off rather than humming.
int speedFromKnob() {
  int reading = analogRead(knobPin);
  if (reading < 30) {
    return 0;
  }
  return map(reading, 30, 1023, minSpeed, 255);
}

void setup() {
  pinMode(motorPin, OUTPUT);
  pinMode(ledPin, OUTPUT);
  pinMode(buttonPin, INPUT_PULLUP);
  Serial.begin(9600);
  Serial.println("Fan. Turn the knob. Press the button for a burst.");
}

void loop() {
  if (buttonJustPressed()) {
    burstUntil = millis() + burstFor;
    Serial.println("burst");
  }

  int speed;
  if (burstUntil > 0 && millis() < burstUntil) {
    speed = 255;
  } else {
    burstUntil = 0;
    speed = speedFromKnob();
  }

  // A deadband, exactly as in the servo gate and for the same
  // reason: analogRead wobbles by a count or two even with your
  // hand off the knob, and acting on every wobble makes the motor
  // hunt up and down instead of holding a speed.
  // Zero is special: off must mean off, whatever the deadband says.
  if (abs(speed - lastSpeed) >= deadband || speed == 0 || lastSpeed == 0) {
    if (speed == lastSpeed) return;
    lastSpeed = speed;
    analogWrite(motorPin, speed);
    digitalWrite(ledPin, speed > 0 ? HIGH : LOW);
    Serial.print("speed ");
    Serial.println(speed);
  }
}

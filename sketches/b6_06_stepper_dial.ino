// ==================================================================
//   BAND 6 SWAP  -  THE STEPPER DIAL
//   Build this INSTEAD of the servo gate, or as well as it.
//
//   WHAT IT DOES
//     A cardboard pointer on a dial. Turn the knob and the pointer
//     goes to that place and stays there. Press the button and it
//     does one full turn and comes back to where the knob says.
//
//   WHAT IS DIFFERENT FROM THE SERVO
//     A servo is told an ANGLE and works out how to get there.
//     A stepper is told a NUMBER OF STEPS and takes exactly that
//     many. It has no idea where it is, and it never will.
//
//     So YOU have to remember where it is. That is the one new idea
//     in this build, and it is the whole reason a stepper feels
//     harder than a servo at first and easier later.
//
//     What you get in exchange: it can turn all the way round, for
//     ever, in either direction. A servo cannot.
//
//   WIRING
//     The 28BYJ-48 motor plugs into its ULN2003 driver board with
//     the white connector. It only fits one way. That end is easy.
//
//     ULN2003 board  ->  Arduino
//       IN1 -> pin 8
//       IN2 -> pin 10
//       IN3 -> pin 9
//       IN4 -> pin 11
//
//     THAT ORDER IS NOT A MISTAKE. 8, 10, 9, 11.
//     The Stepper library wants the two OPPOSITE coils as its
//     first pair, and on this motor those are IN1 and IN3. Wiring
//     them 8-9-10-11 in the obvious order gives the library the
//     wrong pairs, and the motor buzzes and shakes and goes
//     nowhere.
//
//     ULN2003 power:
//       -  to the breadboard MINUS rail
//       +  to the breadboard PLUS rail
//     Battery pack red to the PLUS rail, black to the MINUS rail.
//     ONE wire from the MINUS rail to an Arduino GND pin.
//     That last wire is the shared ground from Band 6 Part 7. The
//     stepper needs it exactly as much as the servo did.
//
//     Potentiometer legs in f5, f6, f7.
//       wire j5 to the MINUS rail
//       wire j6 to pin A0
//       wire j7 STRAIGHT TO THE ARDUINO'S 5V PIN, not the + rail.
//       (The + rail is battery power, about six volts. An Arduino
//        pin must never see more than five.)
//
//     Button legs in e19, e21, f19, f21.
//       wire j19 to pin 2, wire a21 to the MINUS rail.
//
//   THE NUMBER 2048
//     This motor takes 2048 steps to go once round with this
//     library. It is geared down inside, which is why it is slow
//     and why it is strong.
//
//     It is very slightly not 2048. The gearbox is 63.68 to 1, not
//     a round 64, so asking for 2048 steps is about ten steps too many and a
//     "full turn" lands roughly 1.8 degrees PAST where it started
//     and the error builds up over many turns. Nothing here cares.
//     A machine that had to be exact would care a great deal.
//
//   IF IT TURNS THE WRONG WAY
//     The pin order is already right; direction is the thing
//     left. Swap the two wires on Arduino pins 8 and 9, so that
//     IN1 goes to pin 9 and IN3 goes to pin 8. That reverses the
//     order of the library's first pair, which reverses the
//     direction.
//     DO NOT swap 8 and 11. That gives you the buzzing instead.
//
//   IF IT BUZZES AND SHAKES AND GOES NOWHERE
//     That IS the pin order. 8, 10, 9, 11. Four times out of five.
//
//   IT IGNORES YOU WHILE IT IS TURNING, AND THAT IS BAND 5 AGAIN
//     dial.step() blocks. A full turn at speed 10 takes about six
//     seconds, and during those six seconds the knob and the
//     button do nothing at all. That is exactly the delay problem
//     from Band 5, in a library somebody else wrote.
// ==================================================================

#include <Stepper.h>

const int STEPS_PER_TURN = 2048;

//                     steps        IN1 IN3 IN2 IN4  <- coil order
Stepper dial(STEPS_PER_TURN, 8, 9, 10, 11);

int knobPin = A0;
int buttonPin = 2;

int deadband = 20;          // in steps, not degrees
long atStep = 0;            // where we believe the pointer is
int lastButton = HIGH;

// Where the knob is asking for, in steps from the start position.
long wantedStep() {
  int reading = analogRead(knobPin);
  return map(reading, 0, 1023, 0, STEPS_PER_TURN - 1);
}

// Move to a target, remembering where we ended up.
void goToStep(long target) {
  long move = target - atStep;
  if (move == 0) {
    return;
  }
  dial.step(move);
  atStep = target;
}

bool buttonJustPressed() {
  int reading = digitalRead(buttonPin);
  bool pressed = (reading == LOW && lastButton == HIGH);
  lastButton = reading;
  if (pressed) delay(20);
  return pressed;
}

void setup() {
  dial.setSpeed(10);        // revolutions per minute. Small is fine.
  pinMode(buttonPin, INPUT_PULLUP);
  Serial.begin(9600);
  Serial.println("Stepper dial. Turn the knob. Press the button for a full turn.");
}

void loop() {
  if (buttonJustPressed()) {
    Serial.println("full turn");
    dial.step(STEPS_PER_TURN);        // all the way round
    // atStep is unchanged on purpose: a full turn lands where it left.
  }

  long wanted = wantedStep();
  if (abs(wanted - atStep) >= deadband) {
    Serial.print("moving to step ");
    Serial.println(wanted);
    goToStep(wanted);
  }
}

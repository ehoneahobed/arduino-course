// ==================================================================
//   BAND 6, PART 8  -  THE GATE (WORKED EXAMPLE)
//
//   WHAT IT DOES
//     A cardboard arm that holds still where you set it, opens all
//     the way when you press the button, and closes again three
//     seconds later. A light shows whether it is open or shut.
//
//     Nothing blocks. You can turn the knob while it is closing.
//
//   WIRING
//     Servo brown/black -> the breadboard minus rail
//     Servo red         -> the battery pack plus
//     Servo orange      -> pin 9
//
//     Battery pack minus -> the breadboard minus rail
//     ONE wire from the minus rail to an Arduino GND pin.
//     THAT WIRE IS THE WHOLE POINT. See Band 6 Part 7.
//
//     Potentiometer: legs in f5, f6, f7.
//       wire j5 to the MINUS rail
//       wire j6 to pin A0
//       wire j7 STRAIGHT TO THE ARDUINO'S 5V PIN
//
//     READ THAT LAST LINE AGAIN. The plus rail here is BATTERY
//     power, about six volts. An Arduino pin must never see more
//     than five. So the knob takes its power from the Arduino's
//     own 5V pin, on its own wire, and NOTHING from the Arduino
//     touches the plus rail.
//     Button legs in e19, e21, f19, f21.
//       Wire j19 to pin 2. Wire a21 to the minus rail.
//     LED long leg b3, short leg b4.
//       Resistor a3 to a1. Wire b1 to pin 7. Wire a4 to minus rail.
//
//     (b1, not a1: a hole takes ONE leg, and the resistor is in a1.
//      Same column, same connection.)
//
//   THE FOUR IDEAS IN HERE
//     1. A DEADBAND, so a shivering reading does not become a
//        shivering arm.
//     2. millis() instead of delay(), so the three-second wait
//        does not deafen the board. Straight out of Band 5.
//     3. Small functions with names, so loop() reads like a list
//        of jobs rather than a wall.
//     4. One name, openUntil, holding when the gate should shut.
//        0 means it is not open at all.
// ==================================================================

#include <Servo.h>

Servo gate;

int servoPin = 9;
int knobPin  = A0;
int buttonPin = 2;
int ledPin   = 7;

int deadband = 3;          // degrees. Below this we do not bother moving.
int knobMax = 120;         // the knob covers 0..120, so "open" at 180
                           // always looks clearly different from shut
int lastAngle = -100;      // impossible on purpose, so the first read always moves

unsigned long openUntil = 0;   // 0 means "not open"
unsigned long openFor = 3000;

int lastButton = HIGH;

void setup() {
  gate.attach(servoPin);
  pinMode(buttonPin, INPUT_PULLUP);
  pinMode(ledPin, OUTPUT);
  Serial.begin(9600);
}

// Was the button just pressed? Only the moment of pressing counts.
void checkButton() {
  int reading = digitalRead(buttonPin);
  if (reading == LOW && lastButton == HIGH) {
    openUntil = millis() + openFor;
    Serial.println("opened");
    delay(20);              // fine here: nothing else is happening this instant
  }
  lastButton = reading;
}

// Decide where the arm should be, and move it only if it is worth it.
void moveGate() {
  int wanted;

  if (openUntil > 0 && millis() < openUntil) {
    wanted = 180;                                   // held open
  } else {
    openUntil = 0;
    wanted = map(analogRead(knobPin), 0, 1023, 0, knobMax);  // back under the knob
  }

  if (abs(wanted - lastAngle) >= deadband) {
    gate.write(wanted);
    lastAngle = wanted;
  }
}

void showState() {
  if (openUntil > 0) {
    digitalWrite(ledPin, HIGH);
  } else {
    digitalWrite(ledPin, LOW);
  }
}

void loop() {
  checkButton();
  moveGate();
  showState();
}

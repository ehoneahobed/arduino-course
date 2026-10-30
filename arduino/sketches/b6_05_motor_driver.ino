// ==================================================================
//   BAND 6, PART 10  -  A DC MOTOR, IF YOUR KIT HAS ONE
//
//   THIS PART IS OPTIONAL. Skip it if you have no motor or no
//   driver board. Nothing later depends on it.
//
//   WHAT IT DOES
//     Runs the motor forwards for two seconds, stops, runs it
//     backwards for two seconds, stops, and repeats.
//
//   WHY YOU CANNOT JUST PUT THE MOTOR ON A PIN
//     An Arduino pin can supply about 20 thousandths of an amp
//     safely. A small DC motor wants ten to twenty TIMES that when
//     it starts turning. Connect one straight to a pin and you are
//     not running a motor, you are damaging a chip.
//
//     A driver board is a switch that the pin operates and the
//     battery powers. The small current gives the order; the big
//     current does the work.
//
//   WIRING, L293D DRIVER
//     L293D pin 1  (enable)  -> Arduino pin 5   (a ~ pin: speed)
//     L293D pin 2  (in 1)    -> Arduino pin 4
//     L293D pin 7  (in 2)    -> Arduino pin 3
//     L293D pin 8  (motor +) -> battery pack plus
//     L293D pin 16 (chip +)  -> Arduino 5V
//     L293D pins 4, 5, 12, 13 -> the minus rail
//     L293D pins 3 and 6     -> the two motor wires
//
//     Battery minus -> the minus rail.
//     ONE wire from the minus rail to an Arduino GND pin.
//     Same rule as the servo. Same reason.
//
//   IF YOU HAVE A 28BYJ-48 STEPPER AND A ULN2003 BOARD INSTEAD
//     Band 6 Part 10 tells you what changes. The idea is the same:
//     the pin gives the order, the battery does the work.
// ==================================================================

int enablePin = 5;   // must be a ~ pin, because speed is PWM
int in1Pin = 4;
int in2Pin = 3;

void setup() {
  pinMode(enablePin, OUTPUT);
  pinMode(in1Pin, OUTPUT);
  pinMode(in2Pin, OUTPUT);
}

// One pin HIGH and the other LOW means one direction.
void forward(int speed) {
  digitalWrite(in1Pin, HIGH);
  digitalWrite(in2Pin, LOW);
  analogWrite(enablePin, speed);
}

// Swap which one is HIGH and the motor turns the other way.
void backward(int speed) {
  digitalWrite(in1Pin, LOW);
  digitalWrite(in2Pin, HIGH);
  analogWrite(enablePin, speed);
}

void stopMotor() {
  analogWrite(enablePin, 0);
}

void loop() {
  forward(200);
  delay(2000);

  stopMotor();
  delay(1000);

  backward(200);
  delay(2000);

  stopMotor();
  delay(1000);
}

// ==================================================================
//   BAND 1, PART 8  -  THE SAME THING, WITH NAMES
//
//   WHAT IT DOES
//     Exactly the same as b1_02. Nothing about the behaviour changes.
//
//   WHAT IS DIFFERENT
//     Every pin number and every timing now has a name at the top.
//     Change the crossing from 5 seconds to 8 by editing ONE line.
//
//     Try the same change in b1_02 and count how many lines you had
//     to edit there. Those two numbers are the lesson of this band.
//
//   WIRING
//     Exactly the same as b1_02.
// ==================================================================

int redPin = 9;
int yellowPin = 8;
int greenPin = 7;

int stopTime = 5000;
int changeTime = 1500;
int goTime = 5000;

void setup() {
  pinMode(redPin, OUTPUT);
  pinMode(yellowPin, OUTPUT);
  pinMode(greenPin, OUTPUT);
}

void loop() {
  digitalWrite(redPin, HIGH);
  digitalWrite(yellowPin, LOW);
  digitalWrite(greenPin, LOW);
  delay(stopTime);

  digitalWrite(redPin, HIGH);
  digitalWrite(yellowPin, HIGH);
  digitalWrite(greenPin, LOW);
  delay(changeTime);

  digitalWrite(redPin, LOW);
  digitalWrite(yellowPin, LOW);
  digitalWrite(greenPin, HIGH);
  delay(goTime);

  digitalWrite(redPin, LOW);
  digitalWrite(yellowPin, HIGH);
  digitalWrite(greenPin, LOW);
  delay(changeTime);
}

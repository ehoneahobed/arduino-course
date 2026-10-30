// ==================================================================
//   BAND 3 SWAP  -  THE KEYPAD LOCK
//   Build this INSTEAD of the four-button lock.
//
//   It teaches everything the four-button lock teaches: reading an
//   input, edge detection, arrays holding a secret, comparing what
//   was entered with what should have been, and a lockout after
//   three wrong tries. It just looks like the thing it is imitating.
//
//   THE SECRET IS 1 9 4 2. Change it below, in one place.
//
//   WIRING, EIGHT WIRES
//     The keypad is a flat board with eight pins along one edge.
//     Looking at the front with the buttons the right way up, the
//     pins are, LEFT TO RIGHT:
//
//       row1 row2 row3 row4 col1 col2 col3 col4
//
//       leftmost pin  -> pin 9    (row 1, the 1 2 3 A row)
//                     -> pin 8    (row 2)
//                     -> pin 7    (row 3)
//                     -> pin 6    (row 4, the * 0 # D row)
//                     -> pin 5    (column 1, the 1 4 7 * column)
//                     -> pin 4    (column 2)
//                     -> pin 3    (column 3)
//       rightmost pin -> pin 2    (column 4, the A B C D column)
//
//     No resistors. No power wires. The keypad is only switches.
//
//     Green LED long b3, short b4. Resistor a3 to a1.
//       Wire b1 to pin 10. Wire a4 to the minus rail.
//     Red LED long b7, short b8. Resistor a7 to a5.
//       Wire b5 to pin 11. Wire a8 to the minus rail.
//     Buzzer long leg to pin 12, short leg to the minus rail.
//     One wire from the minus rail to a GND pin.
//
//   IF SOME KEYS WORK AND OTHERS DO NOT
//     A row or a column wire is in the wrong place. The rows and
//     columns are easy to get the wrong way round, and the symptom
//     is a keypad where whole lines of keys are dead. Count the
//     pins again from the left.
//
//   IF ONE KEY PRINTS ANOTHER KEY'S CHARACTER
//     Two of your eight wires are swapped. Same fix.
//
//   HOW A KEYPAD ACTUALLY WORKS, WHICH IS WORTH KNOWING
//     Sixteen buttons on eight wires. It cannot be one wire each.
//     The library switches on one row at a time and looks at all
//     four columns, about a hundred times a second. A key press joins one
//     row to one column, so the pair tells you which key it was.
//
//     You already know this shape. It is the same trick as reading
//     four buttons in a loop in Band 3, done in two directions at
//     once. The library is doing it for you; the project page has
//     you watch it happen.
// ==================================================================

#include <Keypad.h>

const byte ROWS = 4;
const byte COLS = 4;

char keys[ROWS][COLS] = {
  {'1','2','3','A'},
  {'4','5','6','B'},
  {'7','8','9','C'},
  {'*','0','#','D'}
};

byte rowPins[ROWS] = {9, 8, 7, 6};
byte colPins[COLS] = {5, 4, 3, 2};

Keypad pad = Keypad(makeKeymap(keys), rowPins, colPins, ROWS, COLS);

int greenPin = 10;
int redPin = 11;
int buzzerPin = 12;

char secret[4] = {'1', '9', '4', '2'};
char entered[4] = {0, 0, 0, 0};
int pressCount = 0;

int wrongTries = 0;

void allOff() {
  digitalWrite(greenPin, LOW);
  digitalWrite(redPin, LOW);
  noTone(buzzerPin);
}

void unlocked() {
  Serial.println("UNLOCKED");
  allOff();
  digitalWrite(greenPin, HIGH);
  tone(buzzerPin, 880);
  delay(150);
  tone(buzzerPin, 1320);
  delay(350);
  noTone(buzzerPin);
  delay(1500);
  digitalWrite(greenPin, LOW);
  wrongTries = 0;
}

void wrong() {
  wrongTries = wrongTries + 1;
  Serial.print("WRONG. Tries: ");
  Serial.println(wrongTries);
  allOff();
  digitalWrite(redPin, HIGH);
  tone(buzzerPin, 200);
  delay(300);
  noTone(buzzerPin);
  delay(200);
  tone(buzzerPin, 200);
  delay(300);
  noTone(buzzerPin);
  delay(400);
  digitalWrite(redPin, LOW);
}

// Ten seconds of nothing working, with the red light flashing.
void lockout() {
  Serial.println("LOCKED OUT for ten seconds");
  allOff();
  for (int i = 0; i < 10; i = i + 1) {
    digitalWrite(redPin, HIGH);
    delay(500);
    digitalWrite(redPin, LOW);
    delay(500);
  }
  wrongTries = 0;
  Serial.println("You may try again.");
}

bool matchesSecret() {
  for (int i = 0; i < 4; i = i + 1) {
    if (entered[i] != secret[i]) {
      return false;
    }
  }
  return true;
}

void startAgain() {
  pressCount = 0;
  for (int i = 0; i < 4; i = i + 1) {
    entered[i] = 0;
  }
}

void setup() {
  pinMode(greenPin, OUTPUT);
  pinMode(redPin, OUTPUT);
  pinMode(buzzerPin, OUTPUT);
  Serial.begin(9600);
  Serial.println("Keypad lock. Four keys, then it decides.");
  Serial.println("* clears what you have typed so far.");
}

void loop() {
  char key = pad.getKey();

  if (key == NO_KEY) {
    return;
  }

  Serial.print("key ");
  Serial.println(key);

  if (key == '*') {
    Serial.println("cleared");
    startAgain();
    return;
  }

  // The pressCount < 4 guard is the one from Band 3 Part 11, and it
  // matters for the same reason: without it a fifth key would be
  // written past the end of a list of four.
  if (pressCount < 4) {
    entered[pressCount] = key;
    pressCount = pressCount + 1;
  }

  if (pressCount == 4) {
    if (matchesSecret()) {
      unlocked();
    } else {
      wrong();
      if (wrongTries >= 3) {
        lockout();
      }
    }
    startAgain();
  }
}

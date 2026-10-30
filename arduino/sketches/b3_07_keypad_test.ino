// ==================================================================
//   BAND 3 SWAP, STAGE ONE  -  PROVE EVERY KEY WORKS
//
//   Do this BEFORE b3_06_keypad_lock.ino.
//
//   WHY THIS EXISTS
//     The lock decides after every four keys, so if you try to test
//     all sixteen keys on the lock itself, every fourth key sets off
//     a wrong-code buzz and the third one locks you out for ten
//     seconds. You would conclude three of your keys were dead.
//
//     This sketch does nothing but print. Press all sixteen keys as
//     fast or as slowly as you like.
//
//   WIRING
//     The keypad is all that matters here. If the lights, the
//     buzzer and the ground wire are already in place from the
//     project page's table, leave them: this sketch never touches
//     those pins and they will simply sit idle.
//     Hold the keypad the right way up, buttons facing you. The
//     eight pins, reading LEFT TO RIGHT:
//
//       1st (leftmost) -> pin 9    row 1, the 1 2 3 A row
//       2nd            -> pin 8    row 2
//       3rd            -> pin 7    row 3
//       4th            -> pin 6    row 4, the * 0 # D row
//       5th            -> pin 5    column 1, the 1 4 7 * column
//       6th            -> pin 4    column 2
//       7th            -> pin 3    column 3
//       8th (rightmost)-> pin 2    column 4, the A B C D column
//
//     No resistors. No power wires. A keypad is only switches.
//
//   WHAT YOU SHOULD SEE
//     Open the serial monitor at 9600 and press every key in turn.
//     Each one prints its own character, once per press.
//     All sixteen, matching what is printed on the key.
//
//   IF WHOLE ROWS OR COLUMNS ARE DEAD
//     A row or column wire is in the wrong place. Count the pins
//     from the left again with the keypad the right way up.
//
//   IF ONE KEY PRINTS ANOTHER KEY'S CHARACTER
//     Two of your eight wires are swapped. Same fix.
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

int seen = 0;

void setup() {
  Serial.begin(9600);
  Serial.println();
  Serial.println("Keypad test. Press every key. Nothing else is wired yet.");
  Serial.println();
}

void loop() {
  char key = pad.getKey();
  if (key != NO_KEY) {
    seen = seen + 1;
    Serial.print("key ");
    Serial.print(key);
    Serial.print("      presses so far: ");
    Serial.println(seen);
  }
}

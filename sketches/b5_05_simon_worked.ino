// ==================================================================
//   BAND 5, PART 9  -  THE MEMORY GAME
//
//   WHAT IT DOES
//     One light flashes with its note. Copy it with the matching
//     button. Then two, then three, and so on. Get one wrong and
//     all four flash with a low buzz and your score prints.
//
//   WIRING
//     Light 1  long b3,  short b4.  Resistor a3 to a1.   Wire b1 to pin 2.
//     Light 2  long b7,  short b8.  Resistor a7 to a5.   Wire b5 to pin 3.
//     Light 3  long b11, short b12. Resistor a11 to a9.  Wire b9 to pin 4.
//     Light 4  long b15, short b16. Resistor a15 to a13. Wire b13 to pin 5.
//
//     Button 1  columns 19 and 21  wire j19 to pin 8,  a21 to minus rail
//     Button 2  columns 24 and 26  wire j24 to pin 9,  a26 to minus rail
//     Button 3  columns 29 and 31  wire j29 to pin 10, a31 to minus rail
//     Button 4  columns 34 and 36  wire j34 to pin 11, a36 to minus rail
//
//     Buzzer long b40, short b42. Wire a40 to pin 12, a42 to minus rail.
//     One wire from the minus rail to a GND pin.
//
//     This needs a large breadboard. If you only have small ones,
//     put the buttons on a second board and join the two minus
//     rails with one wire.
//
//   NOTHING MUST BE WIRED TO A0
//     randomSeed(analogRead(A0)) needs A0 to be empty and drifting.
//     If A0 has something on it, the game plays the same sequence
//     every single time you switch it on.
//
//   FOUR FUNCTIONS, ONE JOB EACH
//     playStep      show one light and play its note
//     allLights     switch all four on or off together
//     waitForPress  wait for a button, and say which one it was
//     gameOver      print the score, flash, and reset
//
//     Read loop on its own. It is nine lines of real work.
//     That is what functions bought you.
// ==================================================================

int ledPins[4] = {2, 3, 4, 5};
int buttonPins[4] = {8, 9, 10, 11};
int notes[4] = {262, 330, 392, 523};
int buzzerPin = 12;

int sequence[32];
int sequenceLength = 0;

void playStep(int which) {
  digitalWrite(ledPins[which], HIGH);
  tone(buzzerPin, notes[which]);
  delay(400);

  digitalWrite(ledPins[which], LOW);
  noTone(buzzerPin);
  delay(120);
}

void allLights(int state) {
  for (int i = 0; i < 4; i = i + 1) {
    digitalWrite(ledPins[i], state);
  }
}

int waitForPress() {
  while (true) {
    for (int i = 0; i < 4; i = i + 1) {

      if (digitalRead(buttonPins[i]) == LOW) {
        playStep(i);

        while (digitalRead(buttonPins[i]) == LOW) {
          delay(5);
        }
        delay(50);

        return i;
      }
    }
  }
}

void gameOver() {
  Serial.print("Game over. Your score: ");
  Serial.println(sequenceLength - 1);

  for (int i = 0; i < 3; i = i + 1) {
    allLights(HIGH);
    tone(buzzerPin, 110);
    delay(300);

    allLights(LOW);
    noTone(buzzerPin);
    delay(200);
  }

  sequenceLength = 0;
  delay(1500);
  Serial.println("New game. Watch carefully.");
}

void setup() {
  for (int i = 0; i < 4; i = i + 1) {
    pinMode(ledPins[i], OUTPUT);
    pinMode(buttonPins[i], INPUT_PULLUP);
  }
  pinMode(buzzerPin, OUTPUT);

  randomSeed(analogRead(A0));

  Serial.begin(9600);
  Serial.println("Simon Says. Watch, then copy.");
}

void loop() {

  if (sequenceLength >= 32) {
    Serial.println("You reached 32. Nobody does that. Well done.");
    sequenceLength = 0;
    delay(3000);
    return;
  }

  sequence[sequenceLength] = random(0, 4);
  sequenceLength = sequenceLength + 1;

  Serial.print("Round ");
  Serial.println(sequenceLength);

  delay(800);
  for (int i = 0; i < sequenceLength; i = i + 1) {
    playStep(sequence[i]);
  }

  for (int i = 0; i < sequenceLength; i = i + 1) {
    int pressed = waitForPress();

    if (pressed != sequence[i]) {
      gameOver();
      return;
    }
  }

  delay(500);
}

// ==================================================================
//   BAND 5, PART 7  -  THE SAME JOB, DONE PROPERLY
//
//   WHAT IT DOES
//     The lamp fades exactly as before. The button now responds
//     instantly, every time, even in the middle of a fade.
//
//   THE IDEA
//     Instead of stopping until it is time, keep running and keep
//     asking whether it is time yet.
//
//       if (now - lastFadeTime >= fadeGap) {
//         lastFadeTime = now;
//         ... do the thing ...
//       }
//       ... everything else, every single round ...
//
//     loop now does ONE STEP of the fade and then leaves, so the
//     brightness has to be remembered in a name outside loop.
//
//   WHY unsigned long
//     millis() gets very large. After an hour it is 3 600 000.
//     An int cannot hold that. Use int here and it works for about
//     half a minute and then goes strange.
//
//   TRY BREAKING IT
//     Delete  lastFadeTime = now;  and upload. In this pattern that
//     line is not tidying up. It IS the timer.
//
//   WIRING
//     Keep the Band 5 build exactly as it is and MOVE FOUR WIRES.
//     Unplug the USB cable first.
//
//     DO THEM IN THIS ORDER. Only ONE wire fits in an Arduino pin,
//     and pins 9 and 8 are both occupied right now.
//
//       1. the wire from j24 : pin 9  ->  OUT   (frees pin 9)
//       2. the wire from j19 : pin 8  ->  PIN 6 (frees pin 8;
//                                               this is the button)
//       3. the wire from b1  : pin 2  ->  PIN 9 (the fading lamp)
//       4. the wire from b5  : pin 3  ->  PIN 8 (the answer light)
//
//     Pin 9 matters. Only a pin with a ~ can fade, and pin 2,
//     where that light was, cannot.
//
//     Lights 3 and 4 and buttons 3 and 4 are not used here, so
//     leave them alone. Button 2 is not used either, but its wire
//     had to come out of pin 9 to make room for the lamp.
//
//     WHEN YOU HAVE FINISHED PART 7, PUT ALL FOUR WIRES BACK:
//       b1 -> pin 2, b5 -> pin 3, j19 -> pin 8, j24 -> pin 9,
//     or the game in Part 9 will not work.
// ==================================================================

int buttonPin = 6;
int lampPin = 9;
int answerPin = 8;

int level = 0;
int step = 4;

unsigned long lastFadeTime = 0;
unsigned long fadeGap = 20;

void setup() {
  pinMode(buttonPin, INPUT_PULLUP);
  pinMode(lampPin, OUTPUT);
  pinMode(answerPin, OUTPUT);
}

void loop() {

  unsigned long now = millis();

  if (now - lastFadeTime >= fadeGap) {
    lastFadeTime = now;

    level = level + step;

    if (level >= 255) {
      level = 255;
      step = -4;
    }
    if (level <= 0) {
      level = 0;
      step = 4;
    }

    analogWrite(lampPin, level);
  }

  if (digitalRead(buttonPin) == LOW) {
    digitalWrite(answerPin, HIGH);
  } else {
    digitalWrite(answerPin, LOW);
  }
}

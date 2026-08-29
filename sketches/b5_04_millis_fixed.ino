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
//     Keep the Band 5 build exactly as it is and MOVE THREE WIRES.
//     Unplug the USB cable first.
//
//       the wire from a1  : pin 2  ->  PIN 9   (the fading lamp)
//       the wire from a5  : pin 3  ->  PIN 8   (the answer light)
//       the wire from j19 : pin 8  ->  PIN 6   (the button)
//
//     Pin 9 matters. Only a pin with a ~ can fade, and pin 2,
//     where that light was, cannot.
//
//     Lights 3 and 4 and buttons 2, 3 and 4 are not used here.
//     Leave them alone.
//
//     WHEN YOU HAVE FINISHED PART 7, MOVE ALL THREE WIRES BACK,
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

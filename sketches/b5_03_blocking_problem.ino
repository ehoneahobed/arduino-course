// ==================================================================
//   BAND 5, PART 6  -  THIS ONE FAILS ON PURPOSE
//
//   WHAT IT SHOULD DO
//     A lamp fades slowly up and down, and a second light comes on
//     whenever you hold a button.
//
//   WHAT IT ACTUALLY DOES
//     The fade works perfectly. The button almost never does.
//
//   WHY
//     Count the delays. 128 rounds at 20 ms each is about two and a
//     half seconds of doing nothing at all. The button is checked
//     ONCE, at the very bottom, after all of that.
//
//     Your press has to land in exactly that instant to be seen.
//
//     The board is not broken. It is busy. Every delay you have
//     ever written stops the WHOLE board, not just one light.
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

void setup() {
  pinMode(buttonPin, INPUT_PULLUP);
  pinMode(lampPin, OUTPUT);
  pinMode(answerPin, OUTPUT);
}

void loop() {

  for (int level = 0; level <= 255; level = level + 4) {
    analogWrite(lampPin, level);
    delay(20);
  }
  for (int level = 255; level >= 0; level = level - 4) {
    analogWrite(lampPin, level);
    delay(20);
  }

  if (digitalRead(buttonPin) == LOW) {
    digitalWrite(answerPin, HIGH);
  } else {
    digitalWrite(answerPin, LOW);
  }
}

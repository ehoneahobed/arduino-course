// ==================================================================
//   BAND 0, PART 6  -  A WORKED EXAMPLE
//
//   WHAT IT DOES
//     Blinks a signature: two short flashes, one long flash,
//     then a rest, over and over.
//
//   WIRING
//     None. Uses the built-in light on pin 13.
//
//   WHAT IS NEW HERE
//     The five lines at the top give names to numbers.
//     int shortFlash = 150;  means: make a name called shortFlash
//     and put 150 in it. After that, writing shortFlash anywhere
//     is the same as writing 150.
//     Change one number at the top and the whole pattern changes.
// ==================================================================

int ledPin = 13;
int shortFlash = 150;
int longFlash = 700;
int gap = 200;
int rest = 1200;

void setup() {
  pinMode(ledPin, OUTPUT);
}

void loop() {
  digitalWrite(ledPin, HIGH);
  delay(shortFlash);
  digitalWrite(ledPin, LOW);
  delay(gap);

  digitalWrite(ledPin, HIGH);
  delay(shortFlash);
  digitalWrite(ledPin, LOW);
  delay(gap);

  digitalWrite(ledPin, HIGH);
  delay(longFlash);
  digitalWrite(ledPin, LOW);
  delay(rest);
}

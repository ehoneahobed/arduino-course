// ==================================================================
//   WHICH BUZZER HAVE I GOT?
//
//   Some kits contain an ACTIVE buzzer, some a PASSIVE one, and many
//   contain one of each. They look almost identical from above and
//   they behave completely differently.
//
//   You need to know which is which before Band 3 and Band 5.
//   This sketch tells you in ten seconds.
//
//   WIRING
//     Buzzer long leg to pin 8.
//     Buzzer short leg to the minus rail.
//     One wire from the minus rail to a GND pin.
//     No resistor.
//
//   WHAT IT DOES
//     Over and over, it does two things and prints which one it is
//     doing, so you can watch the serial monitor and listen at the
//     same time:
//
//       STEP 1  switches the pin on for one second with
//               digitalWrite. An ACTIVE buzzer makes its own note
//               and will beep. A PASSIVE one has no note of its own
//               and will click once, then go silent.
//
//       STEP 2  plays 440 Hz for one second with tone(). A PASSIVE
//               buzzer plays that note. An ACTIVE one either beeps
//               its own single note or does something scratchy; it
//               cannot change pitch.
//
//   READ YOUR ANSWER OFF THIS TABLE
//
//     Step 1 beeps, step 2 sounds the same     ->  ACTIVE
//     Step 1 clicks once, step 2 plays a note  ->  PASSIVE
//
//   THEN CHECK IT WITH YOUR EYES
//     Turn the buzzer over.
//       Sealed underneath, usually with a sticker  ->  ACTIVE
//       You can see a small green circuit board    ->  PASSIVE
//     The two tests should agree. If they do not, trust this sketch.
//
//   WHICH BANDS NEED WHICH
//     Band 3  either will do. The page gives you a line for each.
//     Band 5  wants PASSIVE, because the game plays four notes.
//             An active one still works with one fixed note.
//     Band 7  wants PASSIVE for the rising note. An active one
//             still gives you the beeping, which is most of it.
//
//   WRITE THE ANSWER ON A SLIP OF PAPER AND KEEP IT IN THE BOX.
// ==================================================================

int buzzerPin = 8;

void setup() {
  pinMode(buzzerPin, OUTPUT);
  Serial.begin(9600);
  Serial.println();
  Serial.println("Which buzzer have I got?");
  Serial.println("Listen while you read.");
  Serial.println();
}

void loop() {
  Serial.println("STEP 1  switching the pin on. Active beeps, passive clicks once.");
  digitalWrite(buzzerPin, HIGH);
  delay(1000);
  digitalWrite(buzzerPin, LOW);

  delay(700);

  Serial.println("STEP 2  playing 440 Hz. Passive plays a note, active cannot.");
  tone(buzzerPin, 440);
  delay(1000);
  noTone(buzzerPin);

  Serial.println();
  Serial.println("Beeped twice the same     -> ACTIVE");
  Serial.println("Clicked, then a real note -> PASSIVE");
  Serial.println("-----------------------------------");
  Serial.println();

  delay(2000);
}

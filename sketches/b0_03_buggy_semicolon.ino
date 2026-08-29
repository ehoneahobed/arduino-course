// ==================================================================
//   BAND 0, PART 7b  -  THIS ONE IS BROKEN ON PURPOSE
//
//   WHAT IT DOES
//     Nothing. It will not compile. That is its job.
//
//   WHAT TO DO
//     Press Verify. Read the red message at the bottom of the window.
//     It will say something like:
//       expected ';' before '}' token
//     and it will point at line 24.
//
//     The mistake is on line 23. The missing semicolon.
//
//     Work out why the message points at the wrong line BEFORE you
//     fix it. Band 0 Part 7b has the answer.
//
//   WIRING
//     None.
// ==================================================================

void setup() {
  pinMode(13, OUTPUT)
}

void loop() {
  digitalWrite(13, HIGH);
  delay(500);
  digitalWrite(13, LOW);
  delay(500);
}

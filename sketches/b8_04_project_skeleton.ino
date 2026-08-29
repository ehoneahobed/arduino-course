// ==================================================================
//   BAND 8  -  START YOUR OWN PROJECT FROM THIS FILE
//
//   HOW TO USE IT
//     Save a copy under your own name. Then work down the file
//     from the top, filling in the parts marked TODO. Do not
//     start by typing code. Start by filling in the brief and the
//     criteria at the top, in words, before anything else.
//
//     This file compiles as it stands. Upload it now and it will
//     do nothing at all, correctly. Then make it do one thing.
//
//   ------------------------------------------------------------
//   TODO 1  THE BRIEF, in the words of the person who has the
//           problem. Not your words. Theirs.
//
//     "                                                        "
//
//   TODO 2  THE CRITERIA. How you will know it works. Write these
//           BEFORE you build, so you cannot quietly move them
//           afterwards to whatever you happened to achieve.
//           Each one must be something a person can check.
//
//     1.
//     2.
//     3.
//     4.  What happens after a power cut?
//     5.  Can somebody who has never seen it tell what it is doing?
//
//   TODO 3  THE STATES. What is this device DOING at any moment?
//           Aim for three or four. If you have seven, two of them
//           are probably the same thing.
//   ------------------------------------------------------------
// ==================================================================

// ---- TODO 3: name your states here ----
const int IDLE    = 0;
const int WORKING = 1;
const int DONE    = 2;

int state = IDLE;

// ---- TODO 4: your pins, each with a name that says its job ----
// int sensorPin = A0;
// int lampPin = 7;
// int buttonPin = 2;

// ---- TODO 5: numbers you will want to tune, each named once ----
// int threshold = 500;
// unsigned long holdFor = 3000;

unsigned long stateSince = 0;

// The only place state ever changes. Anything that must happen the
// MOMENT a state begins goes here, once.
void enterState(int newState) {
  state = newState;
  stateSince = millis();

  // TODO 6: switch outputs to match the new state.
  // Set EVERY output in here, including the ones you are turning
  // off. Leaving one out is how a light gets stuck on.

  Serial.print("state ");
  Serial.println(state);
}

// ---- TODO 7: one function per state. Each one answers two
//      questions: what do I do while I am here, and what would
//      make me leave?

void runIdle() {
  // do nothing much
  // if (something happened) enterState(WORKING);
}

void runWorking() {
  // do the job
  // if (finished) enterState(DONE);
}

void runDone() {
  // show that it is finished
  // if (millis() - stateSince >= holdFor) enterState(IDLE);
}

void setup() {
  Serial.begin(9600);

  // TODO 8: pinMode for every pin you named above.

  enterState(IDLE);
}

void loop() {
  // TODO 9: read your inputs ONCE, at the top, into named values.

  if      (state == IDLE)    runIdle();
  else if (state == WORKING) runWorking();
  else if (state == DONE)    runDone();

  // No delay here if anything must stay responsive. Use millis()
  // and the pattern from Band 5.
}

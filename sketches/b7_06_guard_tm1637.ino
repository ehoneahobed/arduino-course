// ==================================================================
//   BAND 7 SWAP  -  THE PARKING GUARD ON A TM1637 DISPLAY
//   Build this INSTEAD of the LCD version.
//
//   It is the same device and the same lesson, and it is smaller in
//   every direction: two pins instead of six, four wires to the
//   screen instead of twelve, a shorter sketch, and digits you can
//   read from across a room, which the LCD cannot manage.
//
//   If the sixteen-wire screen defeated you, come here. Be honest
//   about the trade: you lose the padding bug, the contrast knob,
//   the hunt for one wrong wire among twelve, and the sixteen-
//   character writing exercise, which is the band's best design
//   problem and cannot be done on four digits. The project page
//   makes you do that one on paper anyway.
//
//   IS THIS YOUR DISPLAY?
//     A small blue board, four red digits, a colon in the middle,
//     and FOUR PINS marked CLK, DIO, VCC and GND. If yours has
//     sixteen pins along the top and no board behind it, that is an
//     LCD and you want b7_05_bin_worked_parallel.ino instead.
//
//   YOU NEED ONE LIBRARY
//     Tools, then Manage Libraries, search TM1637, install the one
//     by Avishay Orpaz. Once, on one machine.
//
//   WIRING, TWELVE WIRES IN TOTAL
//     Display        ->
//       CLK -> pin 2
//       DIO -> pin 3
//       VCC -> the PLUS rail
//       GND -> the MINUS rail
//
//     HC-SR04        ->
//       VCC -> the PLUS rail
//       Trig -> pin 10
//       Echo -> pin 11
//       GND -> the MINUS rail
//
//     Buzzer body in the board, long leg b40, short leg b42.
//       Wire a40 to pin 6, wire a42 to the MINUS rail. No resistor.
//
//     One wire from the PLUS rail to the Arduino's 5V pin.
//     One wire from the MINUS rail to a GND pin.
//
//     WHY THE RAILS. Two things want 5V and the board has one 5V
//     pin. One wire per pin, always. The rail is how two things
//     share one pin without two wires meeting in one hole.
//
//     ECHO GOES ON PIN 11. If you got as far as Band 7 Part 6b you
//     moved it to pin 9, because the LCD wanted 11 for itself.
//     Move it back. Left on pin 9 it reads nothing and you get a
//     permanent 999 that looks exactly like a broken sensor.
//
//   WHAT IS DIFFERENT FROM THE LCD VERSION, AND WHY IT MATTERS
//     No padding. None.
//
//     The LCD needed spaces printed after a short number, because
//     writing 99 over 100 left the old third character sitting
//     there. showNumberDec draws all four digits every time, so
//     there is nothing to leave behind.
//
//     That is worth stopping on. The problem you spent half of
//     Band 7 Part 7 solving does not exist on this display, because
//     the chip on the board handles it. Two devices, same job,
//     completely different bugs available to you.
//
//   THE COLON, AND THE ONE THING PEOPLE GET WRONG ABOUT IT
//     There are two ways to light the colon and they use
//     DIFFERENT numbers. Mixing them up gives you a middle dash
//     instead of two dots, which looks like a broken display.
//
//       showNumberDecEx(value, 0x40)   <- the dots bitmask
//       setSegments: data[1] = data[1] | 0x80
//
//     0x80 is the colon bit on the second digit. 0x40 is segment
//     G, the middle dash, when you are drawing segments by hand.
//     Here the colon is off and neither is used.
// ==================================================================

#include <TM1637Display.h>

const int CLK = 2;
const int DIO = 3;
TM1637Display screen(CLK, DIO);

int trigPin = 10;
int echoPin = 11;
int buzzerPin = 6;

long lastShown = -1;
unsigned long lastBeep = 0;
bool beeping = false;

long readDistance() {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  unsigned long microseconds = pulseIn(echoPin, HIGH, 25000);
  if (microseconds == 0) {
    return 999;                  // heard nothing: treat as far away
  }
  return microseconds / 29 / 2;
}

// How long between beeps. Smaller is faster. 0 is one solid tone,
// -1 is silence. Exactly the same scale as the LCD version.
int gapFor(long cm) {
  if (cm < 10)  return 0;
  if (cm < 30)  return 120;
  if (cm < 60)  return 350;
  if (cm < 100) return 800;
  return -1;
}

void showDistance(long cm) {
  if (cm == lastShown) {
    return;
  }
  lastShown = cm;
  screen.showNumberDec(cm, false);   // false: no leading zeros
}

void updateBeep(long cm) {
  int gap = gapFor(cm);

  if (gap < 0) {
    noTone(buzzerPin);
    beeping = false;
    return;
  }
  if (gap == 0) {
    tone(buzzerPin, 880);
    beeping = true;
    return;
  }

  unsigned long now = millis();
  if (now - lastBeep >= (unsigned long)gap) {
    lastBeep = now;
    beeping = !beeping;
    if (beeping) {
      tone(buzzerPin, 660);
    } else {
      noTone(buzzerPin);
    }
  }
}

void setup() {
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  pinMode(buzzerPin, OUTPUT);

  screen.setBrightness(5);           // 0 is dimmest, 7 is brightest
  screen.showNumberDec(0, false);
}

void loop() {
  // Silence the buzzer while measuring. tone() runs an interrupt
  // in the background, and pulseIn counts with interrupts on, so a
  // fast beep makes the distance read very slightly long, exactly
  // when you are closest and least want that.
  noTone(buzzerPin);
  long cm = readDistance();

  showDistance(cm);
  updateBeep(cm);
  delay(50);
}

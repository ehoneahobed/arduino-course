// ==================================================================
//   BAND 7, PART 6b  -  THE SCREEN, IF YOURS HAS SIXTEEN BARE PINS
//
//   USE THIS ONE if your LCD is a bare board with a strip of
//   sixteen pins along the top and no small board on the back.
//   If it has a four-pin board on the back, use b7_02 instead.
//
//   WHAT IT DOES
//     Exactly the same as b7_02. Twelve more wires to get there.
//
//   WIRING, TWELVE WIRES AND A KNOB
//     The pins are numbered 1 to 16 from the left, and the numbers
//     are usually printed on the board itself. Check before you
//     start; a few boards are numbered the other way.
//
//       LCD 1  (VSS) -> minus rail
//       LCD 2  (VDD) -> plus rail
//       LCD 3  (V0)  -> the MIDDLE leg of a 10k potentiometer
//       LCD 4  (RS)  -> pin 12
//       LCD 5  (RW)  -> minus rail
//       LCD 6  (E)   -> pin 11
//       LCD 11 (D4)  -> pin 5
//       LCD 12 (D5)  -> pin 4
//       LCD 13 (D6)  -> pin 3
//       LCD 14 (D7)  -> pin 2
//       LCD 15 (A)   -> plus rail   (backlight)
//       LCD 16 (K)   -> minus rail  (backlight)
//
//       Potentiometer left leg  -> minus rail
//       Potentiometer right leg -> plus rail
//
//     LCD pins 7, 8, 9 and 10 stay empty. That is correct.
//     Plus rail to 5V, minus rail to GND.
//
//   THE KNOB IS NOT OPTIONAL
//     LCD pin 3 sets the contrast, and with nothing on it the
//     screen shows nothing at all. That knob is the single most
//     common reason a working screen looks dead. Turn it slowly
//     from end to end before you suspect anything else.
//
//   WHY 12, 11, 5, 4, 3, 2 IN THAT ORDER
//     Those are RS, E, D4, D5, D6, D7. The library needs them in
//     that order. Change the pins if you must, but keep the order.
// ==================================================================

#include <LiquidCrystal.h>

//                RS  E  D4 D5 D6 D7
LiquidCrystal screen(12, 11, 5, 4, 3, 2);

void setup() {
  screen.begin(16, 2);           // 16 columns, 2 rows

  screen.setCursor(0, 0);
  screen.print("Bozoma Hub");

  screen.setCursor(0, 1);
  screen.print("Band 7 ready");
}

void loop() {
  // Nothing. The screen holds what you wrote until you change it.
}

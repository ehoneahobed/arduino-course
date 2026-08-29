// ==================================================================
//   BAND 7, PART 6a  -  THE SCREEN, IF YOURS HAS AN I2C BOARD
//
//   USE THIS ONE if your LCD has a small green board soldered to
//   the back of it with only four pins. If it has a bare strip of
//   sixteen pins, use b7_03_lcd_parallel_given.ino instead.
//
//   WHAT IT DOES
//     Writes two lines on the screen and leaves them there.
//
//   WIRING, FOUR WIRES
//     GND -> the MINUS rail
//     VCC -> the PLUS rail
//     SDA -> pin A4
//     SCL -> pin A5
//
//     Then one wire from the PLUS rail to 5V, and one from the
//     MINUS rail to a GND pin. The distance sensor from Part 2 is
//     already using the one 5V pin, and ONE ARDUINO PIN TAKES ONE
//     WIRE. The rails are how two things share one pin.
//
//     A4 and A5 are not ordinary analog pins here. They are the
//     two pins this chip uses to talk to other boards. You cannot
//     choose different ones.
//
//   THE ADDRESS
//     0x27 below is the screen's address, the way a house has a
//     number. Most of these boards are 0x27. Some are 0x3F.
//     If nothing appears and the contrast is fine, change 0x27 to
//     0x3F and upload again. That is the whole fix, and it is the
//     second thing to try, after the contrast screw.
//
//   THE CONTRAST SCREW
//     On the back of the I2C board there is a tiny blue screw.
//     Turn it slowly with a small screwdriver. Blank at one end,
//     solid blocks at the other, letters somewhere in between.
//     Do this BEFORE you decide anything is broken.
// ==================================================================

#include <Wire.h>
#include <LiquidCrystal_I2C.h>

LiquidCrystal_I2C screen(0x27, 16, 2);   // address, 16 columns, 2 rows

void setup() {
  screen.init();
  screen.backlight();

  screen.setCursor(0, 0);        // column 0, top row
  screen.print("Bozoma Hub");

  screen.setCursor(0, 1);        // column 0, bottom row
  screen.print("Band 7 ready");
}

void loop() {
  // Nothing. The screen holds what you wrote until you change it.
}

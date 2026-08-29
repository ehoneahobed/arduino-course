==================================================================
  ARDUINO SKETCHES FOR BANDS 0, 1 AND 2
  Bozoma Innovation Hub, Aiyinasi
==================================================================

HOW TO OPEN THESE FILES

  1. Install the Arduino IDE from arduino.cc if you have not
     already. Band 0 walks you through it.

  2. In the IDE, click File, then Open, and choose the file
     you want.

  3. The IDE may say the file must be in a folder with the same
     name. That is normal. Click yes and let it do it for you.

  Every file has a long comment at the top telling you what it
  does, how to wire it, and which part of which band it belongs
  to. Read that comment before you upload anything.


WHICH FILE IS WHICH

  BAND 0  -  Bench Ready  (no wiring at all)

    b0_01_blink_given.ino
      Your first sketch. Blinks the light built into the board.

    b0_02_signature_worked.ino
      A worked example: two short flashes, one long, then a rest.

    b0_03_buggy_semicolon.ino
      BROKEN ON PURPOSE. It will not compile. That is its job.
      You are meant to read the error message.
      The mistake is a missing semicolon on line 23.
      The error message will point at line 24 instead.
      Work out why before you fix it.


  BAND 1  -  Signal Tower  (three LEDs on a breadboard)

    b1_01_one_led_given.ino
      One LED on pin 8. Short flash, long gap.

    b1_02_signal_hardcoded.ino
      Three LEDs running a road crossing. All numbers written
      straight into the code.

    b1_03_signal_variables.ino
      The same thing, but every number has a name at the top.
      Compare how hard it is to change a timing in each version.

    b1_04_buggy_silent.ino
      Compiles fine, uploads fine, wiring is fine, and the green
      light never comes on. Find the fault by reading.


  BAND 2  -  Mood Lamp  (fading, and colour)

    b2_01_fade_given.ino
      One LED fading up and down on pin 9.

    b2_02_rgb_colours.ino
      An RGB LED showing named colours one after another.

    b2_03_colour_story_worked.ino
      A worked example: a sunrise, with smooth fades between
      colours. Use this as the starting point for your own lamp.

    b2_04_buggy_nonpwm.ino
      Before you run this one, move the wire that goes to pin 9
      so it goes to pin 7 instead. Then it compiles fine, the
      light works, but it snaps instead of fading.
      One character in the code is wrong.
      When you are done, move the wire back to pin 9 AND change
      the 7 in the code to a 9. Both, not one.


WIRING, IN SHORT

  Band 1 (three lights)
    Red    LED long leg f5,  short leg f6.  Resistor j5 to j3.  Wire j3 to pin 9.
    Yellow LED long leg f10, short leg f11. Resistor j10 to j8. Wire j8 to pin 8.
    Green  LED long leg f15, short leg f16. Resistor j15 to j13. Wire j13 to pin 7.
    Wire from j6, j11 and j16 each to the minus rail.
    ONE wire from the minus rail to a GND pin.

  Band 2 (one fading light)
    LED long leg f5, short leg f6. Resistor j5 to j3.
    Wire j3 to pin 9. Wire j6 to the minus rail. Minus rail to GND.

  Band 2 (RGB LED)
    Four legs into f5, f6, f7, f8, with the LONG LEG in f6.
    Wire j6 to the minus rail, and the minus rail to GND.
    Resistor j5 to j2,  wire j2 to pin 9   (red)
    Resistor j7 to j10, wire j10 to pin 10 (green)
    Resistor j8 to j12, wire j12 to pin 11 (blue)

  Every LED needs its own resistor. An RGB LED needs three.


TWO THINGS TO REMEMBER

  Unplug the USB cable before you change any wiring.

  Only pins 3, 5, 6, 9, 10 and 11 can fade a light. They are the
  ones with a ~ printed next to them on the board.


ABOUT THESE FILES

  All eleven were compiled and tested for the ATmega328P chip
  before they were given to you. Ten of them work. The eleventh,
  b0_03_buggy_semicolon.ino, fails on purpose, and the error
  message quoted in Band 0 is the one it really produces.

  If a sketch does not work, the problem is not the sketch.



==================================================================
  ARDUINO SKETCHES FOR BANDS 3, 4 AND 5
  Bozoma Innovation Hub, Aiyinasi
  Pack 2 of 3: Lock, Guard, Game
==================================================================

HOW TO OPEN THESE FILES

  In the Arduino IDE, click File, then Open, and choose the file
  you want. If the IDE says the file must be in a folder with the
  same name, click yes and let it do it for you.

  Every file has a long comment at the top telling you what it
  does, how to wire it hole by hole, and which part of which band
  it belongs to. Read that comment before you upload anything.

  You will also need the serial monitor from Band 3 onwards.
  Click Tools, then Serial Monitor, and make sure the baud
  number in the corner says 9600.


WHICH FILE IS WHICH

  BAND 3  -  Combination Lock  (buttons)

    b3_01_button_light_given.ino
      A button that switches a light on while you hold it.

    b3_02_serial_watch.ino
      Prints what a pin is reading. Also your button tester:
      change buttonPin to test each of the four in turn.

    b3_03_toggle_buggy.ino
      DOES NOT WORK PROPERLY, on purpose. The logic is correct
      and it still fails. Work out why before you look at the
      fixed one.

    b3_04_toggle_fixed.ino
      The same job done properly. Three lines are different.

    b3_05_lock_worked.ino
      The finished lock. Secret: button 1, 3, 3, 2.


  BAND 4  -  Night Guard  (sensors)

    b4_01_pot_read_given.ino
      Reads the knob and prints 0 to 1023.

    b4_02_pot_dim_led.ino
      The knob controls brightness, using map.

    b4_03_light_read.ino
      Reads the light sensor. Use this one for your
      calibration walk in Part 8.

    b4_04_buggy_intdiv.ino
      Gives 0.00 forever. Nothing is broken and the arithmetic
      is right. One decimal point fixes it.

    b4_05_night_guard_worked.ino
      The finished device. The knob sets what counts as dark.


  BAND 5  -  Simon Says  (functions, sound and timing)

    b5_01_tone_given.ino
      Three rising notes. Needs the passive buzzer.

    b5_02_functions_worked.ino
      Four lights, four notes, and your first function.

    b5_03_blocking_problem.ino
      FAILS ON PURPOSE. The fade works, the button does not.
      This is the most important failure in the whole course.
      Needs THREE WIRES MOVED first. The file header says which.
      Move them back before you build the game.

    b5_04_millis_fixed.ino
      The same job with millis. Fade and button both work.

    b5_05_simon_worked.ino
      The finished game.


THREE THINGS THAT CATCH EVERYBODY

  1. Buttons. Use two legs that are DIAGONALLY OPPOSITE.
     Two legs from the same side are already joined together,
     so the button will read as pressed all the time.

  2. With INPUT_PULLUP: not pressed is 1, pressed is 0.
     This feels backwards and it is not. See Band 3, Part 4.

  3. Whole-number division. 5 / 1023 gives 0, not 0.00489.
     Put a decimal point on one of the numbers.


ABOUT THESE FILES

  All fifteen were compiled and tested for the ATmega328P chip
  before they were given to you. All fifteen compile cleanly.

  Two of them fail at their JOB on purpose, b3_03 and
  b5_03, and the bands tell you which and why. Neither of them
  fails to compile.

  If a sketch does not do what its header says, the problem is
  not the sketch. Work down the problems list at the bottom of
  the band page, in order.

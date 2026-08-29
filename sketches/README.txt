==================================================================
  ARDUINO SKETCHES  -  ALL 53 FILES
  Bands 0 to 8, plus the project sketches
  Bozoma Innovation Hub, Aiyinasi
==================================================================

  This folder holds every sketch in the course. The notes below
  are in three sets, one per pack: bands 0 to 2, then 3 to 5,
  then 6 to 8. The project sketches are listed at the end of this
  preamble.

  In the folder itself every file sorts by name, so a project
  sketch sits next to the band it belongs to: b1_05 comes right
  after b1_04, and so on. Only the two id_ files sort last.

  53 files in all. Every one was compiled and linked for the
  ATmega328P chip before it was given to you.

  SEVEN of them misbehave ON PURPOSE, and the course tells you
  which and why:
    b0_03_buggy_semicolon.ino  will not compile at all
    b1_04_buggy_silent.ino     compiles, one light never comes on
    b2_04_buggy_nonpwm.ino     compiles, snaps instead of fading
    b3_03_toggle_buggy.ino     compiles, does the wrong thing
    b5_03_blocking_problem.ino compiles, does the wrong thing
    b6_03_buggy_jitter.ino     compiles, will not hold still
    b8_02_buggy_flags.ino      compiles, freezes and cannot heal

  An eighth, b7_04_buggy_flicker.ino, works but is unpleasant to
  look at, also on purpose.

  If one of those eight misbehaves for you, nothing is wrong with
  the pack and nothing is wrong with you. Finding the fault is
  the exercise.

  Everything else compiles cleanly and does what its header says.

------------------------------------------------------------------
  THE PROJECT SKETCHES
------------------------------------------------------------------

  These go with the project pages under /projects/ on the site.
  Each one is a different way through a band you have already
  started, not a replacement for it. The page for each says what
  it swaps out and what you still owe the band.

    id_01_which_buzzer.ino     which buzzer am I holding
    id_02_which_rgb.ino        which RGB light am I holding
    b1_05_traffic_module.ino   band 1, the traffic light module
    b2_05_rgb_module.ino       band 2, the RGB module
    b3_07_keypad_test.ino      band 3, prove the keypad first
    b3_06_keypad_lock.ino      band 3, the keypad lock
    b4_06_rain_alarm.ino       band 4, the rain alarm
    b4_07_room_monitor.ino     band 4, the room monitor
    b5_06_reaction_race.ino    band 5, reaction race
    b6_06_stepper_dial.ino     band 6, the stepper dial
    b6_07_fan_transistor.ino   band 6, a fan on a transistor
    b7_06_guard_tm1637.ino     band 7, the guard on 4 digits

  RUN THE TWO id_ SKETCHES FIRST if nobody has labelled your box.
  Two parts in these kits come in two kinds that look alike and
  behave completely differently, and finding out now takes about
  twenty-five minutes. Finding out in the middle of a build costs an evening.

------------------------------------------------------------------
  LIBRARIES
------------------------------------------------------------------

  Bands 0 to 5 need none.

  ALREADY IN THE ARDUINO SOFTWARE, nothing to install:
    Servo            band 6
    LiquidCrystal    band 7, the bare 16-pin screen
    Stepper          the stepper dial project

  YOU MAY HAVE TO INSTALL, and only if you build that thing:
    LiquidCrystal_I2C   band 7, only for a screen with a small
                        board soldered on the back. Part 6a.
    Keypad              by Mark Stanley and Alexander Brevig,
                        for the keypad lock project
    SimpleDHT           by Winlin, for the room monitor project
    TM1637              by Avishay Orpaz, for the four-digit
                        display project

  Tools, then Manage Libraries, then search the name. Once, on
  one machine. With no internet, download the .zip on any machine
  and use Sketch, Include Library, Add .ZIP Library.

------------------------------------------------------------------
  ONE HOLE, ONE LEG
------------------------------------------------------------------

  A breadboard hole takes one lead and no more. Where a resistor
  leg has a hole, the jumper wire goes in a DIFFERENT hole in the
  SAME column. The five holes in a column are joined underneath,
  so it is the same connection.

  The same rule applies at the Arduino: one wire per pin.

------------------------------------------------------------------
  TWO THINGS THAT ARE NOT OPTIONAL
------------------------------------------------------------------

  A MOTOR DRIVEN BY A TRANSISTOR NEEDS ITS DIODE. The fan project
  switches the motor about a thousand times a second, and every
  one of those switch-offs sends a spike back at the transistor.
  Build it without the diode and you are destroying parts slowly
  and invisibly. No diode in your kit? Use the ULN2003 board
  instead; the project page explains how.

  ANYTHING RUNNING FROM ITS OWN BATTERY NEEDS ONE SHARED GROUND
  WIRE back to an Arduino GND pin. Band 6 Part 7 explains why,
  and every build after it depends on you having read that.


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
    Red    LED long leg f5,  short leg f6.  Resistor j5 to j3.  Wire h3 to pin 9.
    Yellow LED long leg f10, short leg f11. Resistor j10 to j8. Wire h8 to pin 8.
    Green  LED long leg f15, short leg f16. Resistor j15 to j13. Wire h13 to pin 7.
    Wire from j6, j11 and j16 each to the minus rail.
    ONE wire from the minus rail to a GND pin.

  Band 2 (one fading light)
    LED long leg f5, short leg f6. Resistor j5 to j3.
    Wire h3 to pin 9. Wire j6 to the minus rail. Minus rail to GND.

  Band 2 (RGB LED)
    Four legs into f5, f6, f7, f8, with the LONG LEG in f6.
    Wire j6 to the minus rail, and the minus rail to GND.
    Resistor j5 to j2,  wire h2 to pin 9   (red)
    Resistor j7 to j10, wire h10 to pin 10 (green)
    Resistor j8 to j12, wire h12 to pin 11 (blue)

  Every LED needs its own resistor. An RGB LED needs three.

  ONE HOLE, ONE LEG. A breadboard hole takes one lead and no
  more. That is why each pin wire sits in row h and not row j:
  the resistor leg already has the row j hole. The five holes in
  a column are joined underneath, so it is the same connection.


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
      Needs FOUR WIRES MOVED first, in the order the file header
      gives. The order matters: two Arduino pins are already
      occupied and only one wire fits in a pin.
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



==================================================================
  ARDUINO SKETCHES FOR BANDS 6, 7 AND 8
  Bozoma Innovation Hub, Aiyinasi
  Pack 3 of 3: Move, Measure, Make
==================================================================

HOW TO OPEN THESE FILES

  In the Arduino IDE, click File, then Open, and choose the file
  you want. If the IDE says the file must be in a folder with the
  same name, click yes and let it do it for you.

  Every file has a long comment at the top telling you what it
  does, how to wire it hole by hole, and which part of which band
  it belongs to. Read that comment before you upload anything.


LIBRARIES YOU NEED

  Servo              comes with the Arduino software. Nothing
                     to install. Used in Band 6.

  LiquidCrystal      comes with the Arduino software. Nothing
                     to install. For BARE 16-pin screens.

  LiquidCrystal_I2C  YOU MUST INSTALL THIS ONE, and only if your
                     screen has a small board on the back with
                     four pins. Tools, then Manage Libraries,
                     search for "LiquidCrystal I2C", and install
                     the one by Frank de Brabander.

  Band 7 has TWO of everything for the screen. Use the file that
  matches the back of YOUR screen and ignore the other one.


WHICH FILE IS WHICH

  BAND 6  -  Things That Move  (servo)

    b6_01_servo_sweep_given.ino
      Sweeps the horn from end to end and back.
      Your first moving thing. Three wires, no breadboard.

    b6_02_servo_knob.ino
      The knob sets the angle. Prints both numbers.

    b6_03_buggy_jitter.ino
      BUZZES ON PURPOSE. The arm will not hold still even with
      your hand off the knob. Band 6 Part 6 explains why, and
      the fix is called a deadband.

    b6_04_servo_gate_worked.ino
      The finished gate. Deadband, millis, four small functions.
      Needs the battery pack and the shared ground wire.

    b6_05_motor_driver.ino
      OPTIONAL. A DC motor through an L293D driver board.
      Skip it if you have no motor. Nothing later needs it.

  BAND 7  -  Distance and Display  (ultrasonic, LCD)

    b7_01_ping_given.ino
      Prints the distance in centimetres. No screen needed.

    b7_02_lcd_i2c_given.ino
      Two lines of text. USE THIS if your screen has a small
      board on the back with four pins.

    b7_03_lcd_parallel_given.ino
      The same two lines. USE THIS if your screen has sixteen
      bare pins along the top. Twelve wires and a contrast knob.

    b7_04_buggy_flicker.ino
      FLICKERS ON PURPOSE. Written for the I2C screen. Band 7
      Part 7 explains the two separate mistakes in it.

    b7_05_bin_worked_i2c.ino
    b7_05_bin_worked_parallel.ino
      The finished parking guard. THE SAME DEVICE, TWICE.
      Pick the one that matches your screen.
      Note the sensor's Echo pin differs between them: pin 11
      for I2C, pin 9 for parallel, because the bare screen
      needs pin 11 for itself.

  BAND 8  -  Build for Nzemaland  (state machines, capstone)

    b8_01_states_given.ino
      Four states, one button, one light. The shape you will
      reuse for every project from here on.

    b8_02_buggy_flags.ino
      FREEZES ON PURPOSE. The same device written with three
      true-or-false names instead of one state. Press three
      times and watch the light stop being written to at all.

    b8_03_tank_alarm_worked.ino
      A whole capstone, end to end: a water tank alarm using
      the Band 7 sensor pointed down at the water. Read its
      header first; it explains the brief and the criteria.

    b8_04_project_skeleton.ino
      START YOUR OWN PROJECT FROM THIS FILE. It compiles as it
      stands and does nothing, correctly. Work down the TODOs
      from the top, beginning with the brief in words.


FOUR THINGS THAT CATCH EVERYBODY

  1. Two power sources need ONE SHARED GROUND. A servo running
     off a battery still needs a wire from the battery's minus
     to an Arduino GND pin. Without it the servo twitches and
     nothing you change in the code will help.

  2. A servo takes an ANGLE, never a speed. Slowness comes from
     you sending many angles with waits between them.

  3. A blank LCD is almost never a broken LCD. Turn the contrast
     knob or the little blue screw slowly from one end to the
     other BEFORE you suspect anything else.

  4. A screen never wipes itself. Printing 99 where 100 was
     leaves the old third character behind. Pad with spaces to
     a fixed width.


ABOUT THESE FILES

  All fifteen were compiled and linked for the ATmega328P chip
  before they were given to you. All fifteen compile cleanly.

  Two of them fail at their JOB on purpose, b6_03 and b8_02,
  and the bands tell you which and why. A third, b7_04, works
  but is unpleasant to look at, also on purpose.

  If a sketch does not do what its header says, the problem is
  not the sketch. Work down the problems list at the bottom of
  the band page, in order.

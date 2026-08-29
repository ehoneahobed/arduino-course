// ==================================================================
//   BAND 4 SWAP  -  THE RAIN ALARM
//   Build this INSTEAD of the night guard.
//
//   It teaches everything Band 4 teaches: an analog reading that
//   means nothing until you measure what it means, a threshold you
//   choose rather than are given, and two numbers instead of one so
//   a wobbling reading cannot flap the alarm.
//
//   WHAT IT DOES
//     Warns you when the sensor board gets wet, so that washing on
//     the line, or a window, or a store room, has somebody watching
//     it. Green light means dry. Red light and a beep mean wet.
//
//   WIRING
//     The rain sensor comes in two pieces joined by two wires:
//       - the BOARD with pins on it, which goes on the breadboard
//       - the flat PLATE with the copper lines, which gets wet
//     Never put the small board where it can get wet. Only the
//     plate goes outside.
//
//   TAKE THE KNOB OFF THE BOARD FIRST.
//     Band 4 wired the potentiometer's middle leg to A0, and this
//     build needs A0 for the rain sensor. Two wires in one pin is
//     forbidden here as everywhere, and the knob would win: your
//     alarm would follow the knob and ignore the plate, with no
//     error message and nothing at all to tell you.
//
//   THIS BUILD USES THE BOTTOM RAILS, the pair nearest row a,
//     because everything here sits in rows a to e. Band 4's own
//     builds used the top pair. Move both rail wires down: PLUS
//     rail to the Arduino's 5V pin, MINUS rail to a GND pin. On
//     most boards the top and bottom rails are NOT joined.
//
//     Small board  ->
//       VCC -> the PLUS rail
//       GND -> the MINUS rail
//       AO  -> pin A0        (the one that gives a number)
//       DO  -> not connected (leave it empty)
//
//     The plate's two pins go to the two screw terminals or the two
//     pins marked on the small board. Either way round is fine.
//
//     Green LED long b3, short b4. Resistor a3 to a1.
//       Wire b1 to pin 7. Wire a4 to the minus rail.
//     Red LED long b7, short b8. Resistor a7 to a5.
//       Wire b5 to pin 8. Wire a8 to the minus rail.
//     Buzzer long leg to pin 6, short leg to the minus rail.
//     One wire from the minus rail to a GND pin.
//
//   THE THING THAT SURPRISES EVERYBODY
//     THE NUMBER GOES DOWN WHEN IT GETS WET.
//
//     Dry, the two copper lines on the plate are not joined, so the
//     reading sits high, usually somewhere above 800. Water bridges
//     them, current flows, and the reading drops. Puddle it and you
//     may see under 300.
//
//     So "wet" is a SMALL number here, and "dark" was a small number
//     in the night guard for a completely different reason. Do not
//     carry either habit anywhere. Measure it every time.
//
//   THE TWO NUMBERS AT THE TOP ARE YOURS, NOT MINE
//     wetLevel and dryLevel below are a starting point from one
//     sensor in one room. Yours will differ, and the whole of this
//     project is finding out by how much. The project page walks
//     you through measuring them with a wet finger, a few drops,
//     and a properly soaked plate.
//
//   ABOUT LEAVING IT OUTSIDE
//     These plates corrode. Current through water eats the copper,
//     slowly, whenever the board is powered and the plate is wet.
//     A plate left out in the rain for a week is a different plate
//     by the end of it. That is not a fault, it is what they are,
//     and it is worth knowing before you build something permanent.
// ==================================================================

int sensorPin = A0;
int greenPin = 7;
int redPin = 8;
int buzzerPin = 6;

// MEASURE YOUR OWN. See the project page.
int wetLevel = 500;      // below this counts as wet
int dryLevel = 700;      // must climb above this to count as dry again

bool isWet = false;

unsigned long lastBeep = 0;
bool beeping = false;

void enterWet() {
  isWet = true;
  digitalWrite(greenPin, LOW);
  digitalWrite(redPin, HIGH);
  Serial.println("WET");
}

void enterDry() {
  isWet = false;
  digitalWrite(greenPin, HIGH);
  digitalWrite(redPin, LOW);
  noTone(buzzerPin);
  beeping = false;
  Serial.println("dry");
}

// Beeps on and off without stopping the board, so the sensor keeps
// being read the whole time. Band 5's millis pattern, used here.
void beepWhileWet() {
  unsigned long now = millis();
  if (now - lastBeep >= 400) {
    lastBeep = now;
    beeping = !beeping;
    if (beeping) {
      tone(buzzerPin, 900);
    } else {
      noTone(buzzerPin);
    }
  }
}

void setup() {
  pinMode(greenPin, OUTPUT);
  pinMode(redPin, OUTPUT);
  pinMode(buzzerPin, OUTPUT);
  Serial.begin(9600);
  Serial.println("Rain alarm. The number goes DOWN when it gets wet.");
  enterDry();
}

void loop() {
  int reading = analogRead(sensorPin);

  Serial.print("reading ");
  Serial.print(reading);
  Serial.print(isWet ? "   WET" : "   dry");
  Serial.println();

  // Two different numbers on the way in and the way out, so a
  // reading wobbling around one boundary cannot flap the alarm.
  if (!isWet && reading <= wetLevel) {
    enterWet();
  }
  if (isWet && reading >= dryLevel) {
    enterDry();
  }

  if (isWet) {
    beepWhileWet();
  }

  delay(200);
}

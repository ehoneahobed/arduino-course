// ==================================================================
//   BAND 4, PART 10  -  THE NIGHT GUARD
//
//   WHAT IT DOES
//     When the room gets darker than the level you set with the
//     knob, the lamp comes on. The serial monitor shows the light
//     reading, your chosen limit, and what the lamp is doing.
//
//     The knob is not controlling the light. It is setting the
//     number that counts as dark. The person using it decides,
//     in their room, at their time of day, without touching code.
//
//   WIRING
//     Knob, light sensor and LED all as in b4_01, b4_02 and b4_03,
//     all at once. The + and minus rails must reach 5V and GND.
//
//   FIND THE FLAW
//     Set the knob so the lamp is right on the edge of coming on,
//     then watch for thirty seconds. It will flicker.
//     Fixing that is the Gold task in Part 12.
// ==================================================================

int lightPin = A1;
int knobPin = A0;
int lampPin = 9;

void setup() {
  pinMode(lampPin, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int light = analogRead(lightPin);
  int threshold = analogRead(knobPin);

  if (light < threshold) {
    digitalWrite(lampPin, HIGH);
  } else {
    digitalWrite(lampPin, LOW);
  }

  Serial.print("light ");
  Serial.print(light);
  Serial.print("   threshold ");
  Serial.print(threshold);

  if (light < threshold) {
    Serial.println("   LAMP ON");
  } else {
    Serial.println("   lamp off");
  }

  delay(200);
}

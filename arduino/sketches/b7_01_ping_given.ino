// ==================================================================
//   BAND 7, PART 3  -  MEASURE A DISTANCE
//
//   WHAT IT DOES
//     Prints the distance to whatever is in front of the sensor,
//     in centimetres, about five times a second.
//
//   WIRING
//     HC-SR04 has four pins, printed on the board itself.
//       VCC  -> 5V
//       Trig -> pin 10
//       Echo -> pin 11   (BUT pin 9 if you have a BARE 16-pin
//                         screen, which needs pin 11 for itself.
//                         Band 7 Part 6b tells you when to move it.)
//       GND  -> GND
//
//     Put the sensor in the breadboard so it stands up and its two
//     silver eyes face the way you want to measure. It will not sit
//     across the middle channel, so put all four legs in one block,
//     columns 20 to 23, rows f to j.
//       Wire j20 to 5V, j21 to pin 10, j22 to pin 11, j23 to GND.
//
//   HOW IT WORKS
//     You give Trig a very short pulse. The sensor sends a click
//     you cannot hear. Then it makes Echo go HIGH and keeps it
//     HIGH until the click comes back.
//
//     So the LENGTH OF TIME Echo stays HIGH is your measurement.
//     pulseIn waits and hands you that length, in millionths of a
//     second, which are called microseconds.
//
//   THE ARITHMETIC
//     Sound travels about 1 cm every 29 microseconds.
//     Your click went to the wall AND came back, so it covered the
//     distance twice.
//
//       distance in cm = microseconds / 29 / 2
//
//     Nothing here is a magic number. 29 is the speed of sound in
//     air, upside down. 2 is because it went and came back.
//
//   WHEN IT READS 0
//     Nothing came back within the time limit. Either there is
//     nothing in range, or the surface is soft, or it is at an
//     angle that bounces the click away from the sensor. 0 means
//     "I did not hear anything", not "zero centimetres".
// ==================================================================

int trigPin = 10;
int echoPin = 11;

void setup() {
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  Serial.begin(9600);
}

void loop() {
  // A clean 10 microsecond pulse on Trig starts a measurement.
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  // Wait for the echo. Give up after 25000 microseconds, which is
  // about 4 metres, so a missing echo does not freeze the board.
  unsigned long microseconds = pulseIn(echoPin, HIGH, 25000);

  long cm = microseconds / 29 / 2;

  Serial.print("time ");
  Serial.print(microseconds);
  Serial.print(" us    distance ");
  Serial.print(cm);
  Serial.println(" cm");

  delay(200);
}

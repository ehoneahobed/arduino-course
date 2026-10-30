// ==================================================================
//   BAND 4 SWAP  -  THE ROOM MONITOR
//   Build this INSTEAD of the night guard.
//
//   It teaches what Band 4 teaches, and it teaches it from the
//   other side. Every other sensor in this course hands you a
//   number from 0 to 1023 that you have to give a meaning to. This
//   one hands you DEGREES, and a PERCENTAGE, already meant.
//
//   That difference is the whole point of building it. Somebody
//   else did the calibration, inside the part, at the factory.
//
//   WHAT IT DOES
//     Reads the temperature and the humidity every two seconds,
//     prints both, and lights a warning when the room goes outside
//     the range you chose.
//
//   THIS BUILD USES THE BOTTOM RAILS, the pair nearest row a,
//     because everything here sits in rows a to e. Band 4's own
//     builds used the top pair. Move both rail wires down: PLUS
//     rail to the Arduino's 5V pin, MINUS rail to a GND pin. On
//     most boards the top and bottom rails are NOT joined.
//
//   WIRING THE SENSOR
//     The DHT11 is the small blue or white block with holes in the
//     front. It has either three or four pins. Look at yours, and
//     READ THE PRINTING rather than counting positions: different
//     factories use different letters and different orders.
//
//     THREE PINS (a module on a small board):
//       Push its pins into a25, a26, a27.
//       ground, marked - or G or GND  -> the MINUS rail
//       power,  marked + or V or VCC  -> the PLUS rail
//       data,   marked S or OUT or DATA or DAT -> pin 4
//
//     FOUR PINS (the bare part, no board):
//       Hold it with the holes facing you and push its four pins
//       into a30, a31, a32, a33, left to right. Then:
//         wire b30 -> the PLUS rail
//         wire b31 -> Arduino pin 4
//         column 32 -> nothing at all
//         wire b33 -> the MINUS rail
//       Then a 10k resistor from c30 to c31. Note the letters:
//       b30 and b31 already hold wires, and a hole takes one leg.
//       The module version has that resistor on the board already,
//       which is what the board is for.
//
//     IF THE PART GETS HOT, UNPLUG AT ONCE. Power and ground are
//     the wrong way round. A DHT11 usually survives a few seconds
//     of that and usually does not survive a minute.
//
//     Green LED long b3, short b4. Resistor a3 to a1.
//       Wire b1 to pin 7. Wire a4 to the minus rail.
//     Red LED long b7, short b8. Resistor a7 to a5.
//       Wire b5 to pin 8. Wire a8 to the minus rail.
//     One wire from the minus rail to a GND pin.
//
//   IT IS SLOW, AND THAT IS NORMAL
//     A DHT11 will not answer faster than about once a second, and
//     it is happier at once every two. Ask it more often and it
//     hands back the same answer or an error. That is the part, not
//     your code.
//
//   IT IS NOT VERY ACCURATE, AND THAT IS ALSO NORMAL
//     Give or take two degrees, and give or take FIVE PERCENT on
//     the humidity. It prints whole numbers, which makes it look
//     more certain than it is: the resolution is one percent and
//     the accuracy is five. Put it next to a real thermometer and
//     you will see the gap. The project
//     page asks you to do exactly that and write down the
//     difference, because a sensor you have not checked against
//     something else is a sensor you are trusting for no reason.
//
//   WHAT AN ERROR LOOKS LIKE
//     If the wiring is wrong you get an error rather than a wrong
//     number, which is a kindness. The sketch prints it plainly.
// ==================================================================

#include <SimpleDHT.h>

int dhtPin = 4;
SimpleDHT11 dht(dhtPin);

int greenPin = 7;
int redPin = 8;

// YOUR NUMBERS. Measure your room first. See the project page.
int tooHot = 32;         // degrees
int tooHumid = 80;       // percent

void setup() {
  pinMode(greenPin, OUTPUT);
  pinMode(redPin, OUTPUT);
  Serial.begin(9600);
  Serial.println("Room monitor. Degrees and percent, straight from the part.");
}

void loop() {
  byte temperature = 0;
  byte humidity = 0;
  int err = SimpleDHTErrSuccess;

  err = dht.read(&temperature, &humidity, NULL);

  if (err != SimpleDHTErrSuccess) {
    Serial.print("could not read the sensor, error ");
    Serial.println(err);
    digitalWrite(greenPin, LOW);
    digitalWrite(redPin, LOW);
    delay(2000);
    return;
  }

  Serial.print((int)temperature);
  Serial.print(" C   ");
  Serial.print((int)humidity);
  Serial.print(" %");

  bool warn = ((int)temperature >= tooHot) || ((int)humidity >= tooHumid);

  if (warn) {
    Serial.println("   WARNING");
    digitalWrite(greenPin, LOW);
    digitalWrite(redPin, HIGH);
  } else {
    Serial.println("   fine");
    digitalWrite(greenPin, HIGH);
    digitalWrite(redPin, LOW);
  }

  delay(2000);        // the part will not answer faster than this
}

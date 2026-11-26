// CHROMAKOPIA | interactive typography | p5.js 2.x
// Add p5.sound to the sketch's libraries for the music interaction.

let font;
let portrait;
let music;

const word = "CHROMAKOPIA";
const backgroundWord = "TylerTheCreator";
const portraitFile = "assets/tyler.jpg";
const fontFile = "assets/PolenoDEMO-Bold.otf";
const musicFile = "assets/music.mp3";

// Smaller cells create a more detailed, but heavier, text portrait.
const cellSize = 24;
let mosaicCells = [];

// These values ease toward the mouse so the title feels weighted.
let titleTiltX = 0;
let titleTiltY = 0;
let titleX = 0;
let titleY = 0;
let pulse = 0;

// White hover highlight fades smoothly instead of switching abruptly.
let titleHover = [];

// --- Title break / rebuild ---
// "intact"     -> normal title
// "broken"     -> letters are falling / have fallen
// "rebuilding" -> letters are flying back into place
let titleState = "intact";
let letters = [];            // physics state for each letter
let spaceCount = 0;          // quick spacebar presses so far
let lastSpaceTime = 0;       // time of the last spacebar press
let titleWarp = 1;           // background warp fades out while the title is broken
let shake = 0;               // screen shake when the title breaks

const spamThreshold = 2;     // break on the 3rd quick press
const spamWindow = 1200;     // ms allowed between presses to count as spamming
const gravity = 1.1;         // higher = faster fall

async function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  textAlign(CENTER, CENTER);
  colorMode(HSB, 360, 100, 100, 100);
  noStroke();

  // Load assets before using them. Add p5.sound in the editor for loadSound().
  font = await loadFont(fontFile);
  portrait = await loadImage(portraitFile);
  music = await loadSound(musicFile);

  textFont(font);
  music.amp(0.35);
  titleHover = Array(word.length).fill(0);
  resetLetters();
  preparePortraitText();
}

function preparePortraitText() {
  // Crop the image to fill the canvas while keeping its original proportions.
  const scaleAmount = max(width / portrait.width, height / portrait.height);
  const cropWidth = width / scaleAmount;
  const cropHeight = height / scaleAmount;
  const cropX = (portrait.width - cropWidth) / 2;
  const cropY = (portrait.height - cropHeight) / 2;
  const croppedPortrait = portrait.get(cropX, cropY, cropWidth, cropHeight);
  croppedPortrait.resize(width, height);

  // Save brightness once, rather than sampling the image every frame.
  mosaicCells = [];

  for (let x = 0; x < width; x += cellSize) {
    for (let y = 0; y < height; y += cellSize) {
      const pixelBrightness = brightness(croppedPortrait.get(x, y));

      mosaicCells.push({
        x: x - width / 2,
        y: y - height / 2,
        brightness: pixelBrightness
      });
    }
  }
}

// Every letter starts at rest: no offset, no rotation, no velocity.
function resetLetters() {
  letters = [];
  for (let i = 0; i < word.length; i++) {
    letters.push({
      ox: 0, oy: 0, oz: 0,        // offset from the letter's home position
      rx: 0, ry: 0, rz: 0,        // rotation
      vx: 0, vy: 0, vz: 0,        // velocity
      vrx: 0, vry: 0, vrz: 0,     // rotation speed
      delay: 0                    // frames to wait before moving
    });
  }
}

function breakTitle() {
  titleState = "broken";
  shake = 1;
  pulse = 1;

  for (let i = 0; i < letters.length; i++) {
    const l = letters[i];
    // Letters on the left drift left, letters on the right drift right.
    const side = map(i, 0, letters.length - 1, -1, 1);

    l.vx = side * random(1, 4) + random(-1.5, 1.5);
    l.vy = random(-16, -6);          // small upward pop before the fall
    l.vz = random(2, 14);
    l.vrx = random(-0.18, 0.18);
    l.vry = random(-0.18, 0.18);
    l.vrz = random(-0.22, 0.22);
    l.delay = floor(random(0, 14));  // staggered, so they don't all drop at once
  }
}

function rebuildTitle() {
  titleState = "rebuilding";

  for (let i = 0; i < letters.length; i++) {
    const l = letters[i];

    // Wrap rotations so the letters don't unwind through many spins.
    l.rx = wrapAngle(l.rx);
    l.ry = wrapAngle(l.ry);
    l.rz = wrapAngle(l.rz);
    l.delay = i * 3;                 // letters return one after another
  }
}

function wrapAngle(angle) {
  return ((angle + PI) % TWO_PI + TWO_PI) % TWO_PI - PI;
}

// True once every letter has dropped below the bottom of the screen.
function allLettersFallen() {
  return letters.every((l) => l.oy > height * 0.7);
}

function updateLetters() {
  if (titleState === "broken") {
    for (const l of letters) {
      if (l.delay > 0) {
        l.delay--;
        continue;
      }

      // Once a letter is far below the screen, stop simulating it.
      if (l.oy > height * 1.5) continue;

      l.vy += gravity;
      l.ox += l.vx;
      l.oy += l.vy;
      l.oz += l.vz;
      l.rx += l.vrx;
      l.ry += l.vry;
      l.rz += l.vrz;
    }
  }

  if (titleState === "rebuilding") {
    let allHome = true;

    for (const l of letters) {
      if (l.delay > 0) {
        l.delay--;
        allHome = false;
        continue;
      }

      // Ease everything back toward the original position and angle.
      l.ox = lerp(l.ox, 0, 0.12);
      l.oy = lerp(l.oy, 0, 0.12);
      l.oz = lerp(l.oz, 0, 0.12);
      l.rx = lerp(l.rx, 0, 0.12);
      l.ry = lerp(l.ry, 0, 0.12);
      l.rz = lerp(l.rz, 0, 0.12);

      const distance = abs(l.ox) + abs(l.oy) + abs(l.oz);
      const spin = abs(l.rx) + abs(l.ry) + abs(l.rz);

      if (distance > 0.5 || spin > 0.01) {
        allHome = false;
      }
    }

    // When every letter has arrived, snap them into place and finish.
    if (allHome) {
      resetLetters();
      titleState = "intact";
      pulse = 1;
    }
  }
}

function draw() {
  background("#06120D");

  // Update the title first so the background warp follows its current position.
  updateTitleMotion();
  updateLetters();

  push();

  // Brief screen shake when the title breaks.
  if (shake > 0) {
    translate(random(-1, 1) * shake * 14, random(-1, 1) * shake * 14, 0);
    shake = max(0, shake - 0.04);
  }

  // Draw the portrait first, so it remains behind the main title.
  drawTextPortrait();
  drawTitle();
  drawPrompt();

  pop();

  // The spacebar pulse eases away over time.
  pulse = max(0, pulse - 0.025);
}

function updateTitleMotion() {
  // Mouse position controls the title's angle and horizontal movement.
  const targetTiltY = map(mouseX, 0, width, -0.6, 0.6);
  const targetTiltX = map(mouseY, 0, height, 0.2, -0.2);
  const targetX = map(mouseX, 0, width, -45, 45);

  // The title rests slightly above center to balance the bottom prompt.
  const restingY = -min(height * 0.075, 48);

  // Vertical mouse movement makes the title travel as well as tilt.
  const mouseVerticalShift = map(mouseY, 0, height, -24, 24);
  const targetY = restingY + mouseVerticalShift;

  titleTiltX = lerp(titleTiltX, targetTiltX, 0.1);
  titleTiltY = lerp(titleTiltY, targetTiltY, 0.1);
  titleX = lerp(titleX, targetX, 0.06);
  titleY = lerp(titleY, targetY, 0.06);

  // The background only bends around the title while the title exists.
  const targetWarp = titleState === "broken" ? 0 : 1;
  titleWarp = lerp(titleWarp, targetWarp, 0.08);
}

function drawTextPortrait() {
  push();
  translate(0, 0, -180);
  textFont(font);

  const titleSize = getTitleSize();
  const titleWidth = getTitleWidth(titleSize);
  const titleHeight = titleSize * 0.9;

  // Expand the rounded warp area as the title tilts in 3D.
  const tiltExpansionX = abs(sin(titleTiltY)) * titleWidth * 0.12;
  const tiltExpansionY = abs(sin(titleTiltX)) * titleHeight * 0.18;
  const halfTitleWidth = titleWidth * 0.53 + tiltExpansionX;
  const halfTitleHeight = titleHeight * 0.55 + tiltExpansionY;
  const cornerRadius = min(halfTitleWidth, halfTitleHeight) * 0.28;

  for (let i = 0; i < mosaicCells.length; i++) {
    const cell = mosaicCells[i];
    const letter = backgroundWord[i % backgroundWord.length];

    // Find this cell's distance from a rounded rectangle around the title.
    const localX = abs(cell.x - titleX) - (halfTitleWidth - cornerRadius);
    const localY = abs(cell.y - titleY) - (halfTitleHeight - cornerRadius);
    const outsideX = max(localX, 0);
    const outsideY = max(localY, 0);

    const roundedDistance =
      sqrt(outsideX * outsideX + outsideY * outsideY) +
      min(max(localX, localY), 0) -
      cornerRadius;

    // The warp fades smoothly around every edge, including top and bottom.
    const distanceFromTitle = max(roundedDistance, 0);
    const warpRadius = max(70, titleSize * 0.28);
    const warpStrength =
      1 - constrain(distanceFromTitle / warpRadius, 0, 1);

    // titleWarp fades the whole effect out while the title is broken.
    const smoothWarp =
      warpStrength * warpStrength * (3 - 2 * warpStrength) * titleWarp;

    // The tilted title pushes the background farther back on its receding side.
    const localTitleX = cell.x - titleX;
    const localTitleY = cell.y - titleY;
    const recedingDepth = max(
      0,
      localTitleY * sin(titleTiltX) -
      localTitleX * sin(titleTiltY)
    );

    // Push the background fully behind the title across its rounded footprint.
    const tiltAmount = abs(titleTiltX) + abs(titleTiltY);
    const zPushBack = smoothWarp * (110 + tiltAmount * 50);

    // A small moving ripple makes the warped letters respond to title movement.
    const ripple =
      sin(frameCount * 0.035 + localTitleX * 0.012) *
      cos(frameCount * 0.03 + localTitleY * 0.014) *
      smoothWarp;

    const letterSize =
      map(cell.brightness, 0, 100, 7, cellSize * 1.2) *
      (1 - smoothWarp * 0.12);

    const greenBrightness = map(cell.brightness, 0, 100, 18, 65);
    const letterOpacity =
      map(cell.brightness, 0, 100, 20, 85) *
      (1 - smoothWarp * 0.15);

    push();
    translate(
      cell.x + ripple * 2,
      cell.y + ripple * 3,
      -zPushBack
    );
    fill(145, 85, greenBrightness, letterOpacity);
    textSize(letterSize);
    text(letter, 0, 0);
    pop();
  }

  pop();
}

function drawTitle() {
  const titleSize = getTitleSize();
  const titleScale = 1 + pulse * 0.18;
  const widths = getLetterWidths(titleSize);
  const totalWidth = widths.reduce((sum, value) => sum + value, 0);
  let cursorX = -totalWidth / 2;

  push();
  translate(titleX, titleY, 0);
  rotateX(titleTiltX);
  rotateY(titleTiltY);
  scale(titleScale);

  textFont(font);
  textSize(titleSize);

  for (let i = 0; i < word.length; i++) {
    const letterWidth = widths[i];
    const letterX = cursorX + letterWidth / 2;
    const l = letters[i];

    // Only react to the pointer while the title is whole.
    const screenLetterX =
      width / 2 + titleX + letterX * titleScale;
    const screenLetterY =
      height / 2 + titleY;

    const overLetter =
      titleState === "intact" &&
      abs(mouseX - screenLetterX) < letterWidth * titleScale * 0.55 &&
      abs(mouseY - screenLetterY) < titleSize * titleScale * 0.48;

    titleHover[i] = lerp(titleHover[i], overLetter ? 1 : 0, 0.16);

    // Each letter moves and spins on its own while falling or rebuilding.
    push();
    translate(letterX + l.ox, l.oy, l.oz);
    rotateX(l.rx);
    rotateY(l.ry);
    rotateZ(l.rz);

    // Dark green repeated faces create the title's extruded 3D edge.
    for (let depth = 8; depth > 0; depth--) {
      push();
      translate(0, 0, -depth * 3);
      fill("#003D25");
      text(word[i], 0, 0);
      pop();
    }

    // Blend each letter from green to white while hovered.
    const greenFace = color("#00A65A");
    const whiteFace = color("#F0E9D8");
    const faceColor = lerpColor(greenFace, whiteFace, titleHover[i]);

    if (pulse > 0.1) {
      fill(lerpColor(faceColor, whiteFace, pulse));
    } else {
      fill(faceColor);
    }

    text(word[i], 0, 0);
    pop();

    cursorX += letterWidth;
  }

  pop();
}

function drawPrompt() {
  push();
  translate(0, 0, 30);
  fill(0, 0, 95, 85);
  textFont(font);
  textSize(16);

  const message =
    titleState === "broken"
      ? (allLettersFallen() ? "Press space to rebuild the title" : "")
      : "Move your mouse or press space";

  text(message, 0, height / 2 - 45);
  pop();
}

function getTitleSize() {
  // Scale the title down when needed so the full word fits the canvas.
  textFont(font);
  textSize(100);

  const widthAt100 = textWidth(word);
  return min(150, (width * 0.9 * 100) / widthAt100);
}

function getTitleWidth(size) {
  textFont(font);
  textSize(size);
  return textWidth(word);
}

function getLetterWidths(size) {
  textFont(font);
  textSize(size);

  const widths = [];
  for (let i = 0; i < word.length; i++) {
    widths.push(textWidth(word[i]));
  }

  return widths;
}

function keyPressed() {
  if (key === " ") {
    pulse = 1;

    // Play the music if it is not already playing.
    if (music && !music.isPlaying()) {
      userStartAudio();
      music.play();
    }

    if (titleState === "broken") {
      // Only rebuild after the letters have finished falling.
      if (allLettersFallen()) {
        rebuildTitle();
        spaceCount = 0;
      }
    } else if (titleState === "intact") {
      // Count presses, but start over if you pause for too long.
      const now = millis();
      if (now - lastSpaceTime > spamWindow) {
        spaceCount = 0;
      }
      lastSpaceTime = now;
      spaceCount++;

      if (spaceCount > spamThreshold) {
        breakTitle();
        spaceCount = 0;
      }
    }

    return false;
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);

  if (portrait) {
    preparePortraitText();
  }
}
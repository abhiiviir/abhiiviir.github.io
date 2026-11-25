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

function draw() {
  background("#06120D");

  // Update the title first so the background warp follows its current position.
  updateTitleMotion();

  // Draw the portrait first, so it remains behind the main title.
  drawTextPortrait();
  drawTitle();
  drawPrompt();

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
    const smoothWarp =
      warpStrength * warpStrength * (3 - 2 * warpStrength);

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

    // Fade a letter toward white when the pointer is over it.
    const screenLetterX =
      width / 2 + titleX + letterX * titleScale;
    const screenLetterY =
      height / 2 + titleY;

    const overLetter =
      abs(mouseX - screenLetterX) < letterWidth * titleScale * 0.55 &&
      abs(mouseY - screenLetterY) < titleSize * titleScale * 0.48;

    titleHover[i] = lerp(titleHover[i], overLetter ? 1 : 0, 0.16);

    // Dark green repeated faces create the title's extruded 3D edge.
    for (let depth = 8; depth > 0; depth--) {
      push();
      translate(0, 0, -depth * 3);
      fill("#003D25");
      text(word[i], letterX, 0);
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

    text(word[i], letterX, 0);
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
  text("Move your mouse or press space", 0, height / 2 - 45);
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

    return false;
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);

  if (portrait) {
    preparePortraitText();
  }
}
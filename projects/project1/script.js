// Font, portrait image, and music file
let font;
let portrait;
let music;

// Main title and repeated text used to build the portrait
let word = "CHROMAKOPIA";
let backgroundWord = "TylerTheCreator";

// Controls portrait detail
let cellSize = 24;
let mosaicCells = [];

// Stores the title's current mouse-controlled position and angle
let titleTiltX = 0;
let titleTiltY = 0;
let titleX = 0;

// Controls the title pulse when space is pressed
let pulse = 0;

async function setup() {
  // WEBGL lets the title rotate in 3D
  createCanvas(windowWidth, windowHeight, WEBGL);
  textAlign(CENTER, CENTER);
  colorMode(HSB, 360, 100, 100, 100);
  noStroke();

  // Load the assets before using them
  font = await loadFont("PolenoDEMO-Bold.otf");
  portrait = await loadImage("tyler.jpg");
  music = await loadSound("music.mp3");

  textFont(font);
  music.amp(0.35); // Set music volume

  preparePortraitText();
}

function preparePortraitText() {
  // Crop the image to fill the canvas without stretching it
  let scaleAmount = max(width / portrait.width, height / portrait.height);
  let cropWidth = width / scaleAmount;
  let cropHeight = height / scaleAmount;
  let cropX = (portrait.width - cropWidth) / 2;
  let cropY = (portrait.height - cropHeight) / 2;

  let croppedPortrait = portrait.get(
    cropX,
    cropY,
    cropWidth,
    cropHeight
  );

  croppedPortrait.resize(width, height);
  mosaicCells = [];

  // Save the brightness at each grid position
  for (let x = 0; x < width; x += cellSize) {
    for (let y = 0; y < height; y += cellSize) {
      let pixelBrightness = brightness(croppedPortrait.get(x, y));

      // Save the position and brightness for drawing later
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

  // Draw the portrait first so the title appears over it
  drawTextPortrait();
  drawTitle();
  drawPrompt();

  // Gradually fade the pulse after a spacebar press
  pulse = max(0, pulse - 0.025);
}

function drawTextPortrait() {
  // Place the text portrait behind the title
  push();
  translate(0, 0, -180);
  textFont(font);

  // Draw one letter at every saved image position
  for (let i = 0; i < mosaicCells.length; i++) {
    let cell = mosaicCells[i];
    let letter = backgroundWord[i % backgroundWord.length];

    // Bright image areas get larger, brighter letters
    let letterSize = map(cell.brightness, 0, 100, 7, cellSize * 1.2);
    let greenBrightness = map(cell.brightness, 0, 100, 18, 65);
    let letterOpacity = map(cell.brightness, 0, 100, 20, 85);

    fill(145, 85, greenBrightness, letterOpacity);
    textSize(letterSize);
    text(letter, cell.x, cell.y);
  }

  pop();
}

function drawTitle() {
  // Map mouse position to the title's tilt and horizontal movement
  let targetTiltY = map(mouseX, 0, width, -0.6, 0.6);
  let targetTiltX = map(mouseY, 0, height, 0.15, -0.15);
  let targetX = map(mouseX, 0, width, -30, 30);

  // Smoothly move the title toward the mouse-controlled values
  titleTiltX = lerp(titleTiltX, targetTiltX, 0.1);
  titleTiltY = lerp(titleTiltY, targetTiltY, 0.1);
  titleX = lerp(titleX, targetX, 0.06);

  // Make the title briefly grow during the pulse
  let titleScale = 1 + pulse * 0.18;

  push();
  translate(titleX, 0, 0);
  rotateX(titleTiltX);
  rotateY(titleTiltY);
  scale(titleScale);

  textFont(font);
  textSize(min(width * 0.12, 150));

  // Repeat the title in dark green layers to create 3D depth
  for (let depth = 8; depth > 0; depth--) {
    push();
    translate(0, 0, -depth * 3);
    fill("#003D25");
    text(word, 0, 0);
    pop();
  }

  // Change the front color briefly when space is pressed
  if (pulse > 0.1) {
    fill("#F0E9D8");
  } else {
    fill("#00A65A");
  }

  text(word, 0, 0);
  pop();
}

function drawPrompt() {
  // Display the interaction prompt at the bottom
  push();
  translate(0, 0, 30);

  fill(0, 0, 95, 85);
  textFont(font);
  textSize(16);
  text("Move your mouse or press space", 0, height / 2 - 45);

  pop();
}

function keyPressed() {
  if (key === " ") {
    pulse = 1; // Trigger the title pulse

    // Play the music once if it is not already playing
    if (!music.isPlaying()) {
      userStartAudio();
      music.play();
    }

    return false; // Prevent the browser from scrolling
  }
}

function windowResized() {
  // Resize the canvas and rebuild the image grid
  resizeCanvas(windowWidth, windowHeight);
  preparePortraitText();
}
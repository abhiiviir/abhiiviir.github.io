// Font, fish models, and catch sound
let titleFont;
let goldfish;
let angler;
let catchSound;

// Title animation
let titleTiltX = 0;
let titleTiltY = 0;

// Tracks which screen or animation is active
let scene = "title";

// Word typed by pressing space
let catchWord = "CATCH";
let lettersShown = 0;
let letterY = [];
let letterSpeed = [];
let lettersFalling = false;

// Fish catch animation values
let fishScale = 0;
let catchProgress = 0;
let caughtOpacity = 0;
let caughtScale = 0.7;

// Tracks which fish is active and its displayed name
let currentFish = 0;
let caughtName = "";
let statHover = [];

async function setup() {
  // WEBGL enables the 3D fish and title tilt
  createCanvas(windowWidth, windowHeight, WEBGL);
  rectMode(CENTER);
  colorMode(HSB, 360, 100, 100, 100);
  textAlign(CENTER, CENTER);
  noStroke();

  // Load assets before drawing them
  titleFont = await loadFont("PPFormula-Medium.otf");
  goldfish = await loadModel("goldfish.obj", true);
  angler = await loadModel("angler.obj", true);
  catchSound = await loadSound("catch.mp3");

  textFont(titleFont);
  catchSound.amp(0.6);
}

function draw() {
  // Draw the water behind everything
  drawOcean();

  // Show only the title on the opening screen
  if (scene === "title") {
    drawTitleScreen();
    return;
  }

  // Draw the smaller title during the game
  drawGameTitle();

  // Draw the word while typing or falling
  if (scene === "typing" || scene === "falling") {
    drawCatchLetters();
  }

  // Show the fish during its reveal and catch animation
  if (scene === "fish" || scene === "catching") {
    drawFish();
  }

  // Show the result and stats after the catch
  if (scene === "caught") {
    drawCaughtMessage();
  }
}

function drawOcean() {
  // Dark blue background
  background("#06152A");
  noStroke();

  // Draw rows of small dots that gently move like water
  for (let row = 0; row < 14; row++) {
    let y = -height / 2 + row * (height / 13);

    for (let x = -width / 2; x < width / 2; x += 24) {
      let wave = sin(x * 0.012 + frameCount * 0.025 + row * 0.6);
      let dotSize = 2 + (wave + 1) * 2;

      fill(190, 55, 85, 18);
      circle(x, y + wave * 8, dotSize);
    }
  }
}

function drawTitleScreen() {
  // Map mouse position to the title's 3D tilt
  let targetTiltY = map(mouseX, 0, width, -0.25, 0.25);
  let targetTiltX = map(mouseY, 0, height, 0.15, -0.15);

  // Smooth the title's movement
  titleTiltX = lerp(titleTiltX, targetTiltX, 0.05);
  titleTiltY = lerp(titleTiltY, targetTiltY, 0.05);

  push();
  rotateX(titleTiltX);
  rotateY(titleTiltY);

  // Main title in the middle of the screen
  fill(0, 0, 100);
  noStroke();
  textAlign(CENTER, CENTER);
  textSize(min(width * 0.08, 100));
  text("What's the Catch?", 0, 0);

  pop();

  // Instruction at the bottom of the title screen
  fill(0, 0, 90);
  textSize(18);
  text("Press space to begin", 0, height / 2 - 55);
}

function drawGameTitle() {
  // Smaller title at the top during the game
  fill(0, 0, 100);
  textAlign(CENTER, CENTER);
  textSize(min(width * 0.05, 72));
  text("What's the Catch?", 0, -height / 2 + 90);
}

function drawCatchLetters() {
  // Position the typed word between the top title and bottom prompt
  let titleY = -height / 2 + 90;
  let promptY = height / 2 - 70;
  let catchY = (titleY + promptY) / 2;

  textSize(64);
  fill(185, 45, 100);

  // Draw each revealed letter
  for (let i = 0; i < lettersShown; i++) {
    let letterX = (i - 2) * 50;
    text(catchWord[i], letterX, catchY + letterY[i]);

    // Gravity speeds up each letter's fall
    if (lettersFalling) {
      letterSpeed[i] += 0.5;
      letterY[i] += letterSpeed[i];
    }
  }

  // Prompt while the word is being typed
  fill(0, 0, 85);
  textSize(16);
  text("Press space to catch something...", 0, promptY);

  // Show the fish after the letters fall off screen
  if (lettersFalling && letterY[0] > height) {
    scene = "fish";
    fishScale = 0;
  }
}

function drawFish() {
  let fishY = 0;

  // Grow the fish into view
  if (scene === "fish") {
    fishScale = min(fishScale + 0.03, 1);
  }

  // Animate the fish being caught
  if (scene === "catching") {
    catchProgress = min(catchProgress + 0.015, 1);

    // Lift the fish upward
    let popProgress = min(catchProgress * 2, 1);
    fishY = -sin(popProgress * HALF_PI) * 55;

    // Shrink the fish as it disappears
    if (catchProgress > 0.35) {
      fishScale = map(catchProgress, 0.35, 1, 1, 0);
    }

    // Move to the caught screen when the animation finishes
    if (catchProgress >= 1) {
      scene = "caught";
      caughtOpacity = 0;
      caughtScale = 0.7;
    }
  }

  // Light the 3D fish
  ambientLight(0, 0, 70);
  directionalLight(0, 0, 100, -1, 1, -1);

  push();
  translate(0, fishY, 0);

  // Correct the angler model's upside-down orientation
  if (currentFish === 1) {
    rotateX(PI);
  }

  // Slowly rotate and scale the fish
  rotateY(frameCount * 0.02);
  scale(fishScale * 1.5);
  ambientMaterial(190, 70, 90);

  // Draw the currently selected fish
  if (currentFish === 0) {
    model(goldfish);
  } else {
    model(angler);
  }

  pop();
}

function drawCaughtMessage() {
  // Fade in and enlarge the result
  caughtOpacity = min(caughtOpacity + 4, 100);
  caughtScale = min(caughtScale + 0.025, 1);

  push();
  scale(caughtScale);

  fill(185, 45, 100, caughtOpacity);
  textAlign(CENTER, CENTER);
  textSize(min(width * 0.06, 72));
  text("You just caught:", 0, -155);

  fill(0, 0, 100, caughtOpacity);
  textSize(32);
  text(caughtName + "!", 0, -70);

  pop();

  // Prompt to start another round
  fill(0, 0, 85, caughtOpacity);
  textSize(16);
  text("Press space to catch another one", 0, 15);

  // Draw the interactive stats below the message
  drawFishStats();
}

function drawFishStats() {
  let labels = ["Length", "Lifespan", "Weight"];
  let displayValues;
  let values;
  let maximums;

  // Set facts and bar scales for the selected fish
  if (currentFish === 0) {
    // Goldfish: Carassius auratus
    displayValues = ["15–20 cm", "6–7 years", "100–300 g"];
    values = [20, 7, 300];
    maximums = [30, 10, 500];
  } else {
    // Anglerfish figures refer to goosefish, Lophius piscatorius
    displayValues = ["Up to 1.2 m", "Up to 25 years", "Up to 57.7 kg"];
    values = [120, 25, 57.7];
    maximums = [150, 30, 60];
  }

  let chartWidth = min(width * 0.46, 500);
  let rowHeight = 34;
  let rowGap = 52;
  let firstY = 175;

  // Set a hover animation value for each stat bar
  if (statHover.length !== labels.length) {
    statHover = Array(labels.length).fill(0);
  }

  // Convert mouse position to WEBGL's centered coordinates
  let mouseCanvasX = mouseX - width / 2;
  let mouseCanvasY = mouseY - height / 2;

  for (let i = 0; i < labels.length; i++) {
    let y = firstY + i * rowGap;
    let leftX = -chartWidth / 2;

    // Check whether the mouse is over this bar
    let isHovered =
      mouseCanvasX >= leftX &&
      mouseCanvasX <= leftX + chartWidth &&
      mouseCanvasY >= y - rowHeight / 2 &&
      mouseCanvasY <= y + rowHeight / 2;

    // Smoothly animate the hover color
    statHover[i] = lerp(statHover[i], isHovered ? 1 : 0, 0.12);

    let baseBlue = color("#4169E1");
    let hoverBlue = color("#87CEFA");
    let barColor = lerpColor(baseBlue, hoverBlue, statHover[i]);

    // Grey track behind the colored bar
    noStroke();
    fill("#454b57");
    rect(0, y, chartWidth, rowHeight, rowHeight / 2);

    // Calculate how much of the track the value fills
    let barAmount = values[i] / maximums[i];
    let filledWidth = chartWidth * barAmount;

    fill(barColor);
    rect(leftX + filledWidth / 2, y, filledWidth, rowHeight, rowHeight / 2);

    // Draw the stat label inside the bar
    fill(255, caughtOpacity);
    textAlign(LEFT, CENTER);
    textSize(14);
    text(labels[i], leftX + 14, y);

    // Reveal the value beside the bar on hover
    if (statHover[i] > 0.05) {
      fill(255, statHover[i] * caughtOpacity);
      textAlign(LEFT, CENTER);
      textSize(14);
      text(displayValues[i], leftX + chartWidth + 14, y);
    }
  }

  textAlign(CENTER, CENTER);
}

function keyPressed() {
  // Ignore keys other than space
  if (key !== " ") {
    return;
  }

  // Space leaves the title screen and starts the game
  if (scene === "title") {
    scene = "typing";
    return false;
  }

  // Reveal one letter each time space is pressed
  if (scene === "typing" && !lettersFalling) {
    if (lettersShown < catchWord.length) {
      letterY[lettersShown] = 0;
      letterSpeed[lettersShown] = 0;
      lettersShown++;
    }

    // Start the falling animation after the last letter
    if (lettersShown === catchWord.length) {
      lettersFalling = true;
      scene = "falling";
    }

    return false;
  }

  // Reset the word and switch fish for another round
  if (scene === "caught") {
    currentFish = 1 - currentFish;
    lettersShown = 0;
    letterY = [];
    letterSpeed = [];
    lettersFalling = false;
    fishScale = 0;
    catchProgress = 0;
    caughtOpacity = 0;
    caughtScale = 0.7;
    statHover = [];
    scene = "typing";

    return false;
  }
}

function mousePressed() {
  // Only catch a fish when the fish screen is active
  if (scene !== "fish") {
    return;
  }

  // Save the name for the result screen
  caughtName = currentFish === 0 ? "Goldfish" : "Anglerfish";

  // Play the sound and start the catch animation
  catchSound.play();
  catchProgress = 0;
  scene = "catching";
}
// WHAT'S THE CATCH? | p5.js 2.x
// Keep this sketch, the fish assets, font, sound, and overfishing_europe.csv
// in the same project folder. Enable p5.sound in index.html.

let titleFont;
let goldfish;
let angler;
let catchSound;

let scene = "title";
let titleTiltX = 0;
let titleTiltY = 0;

let catchWord = "CATCH";
let lettersShown = 0;
let letterY = [];
let letterSpeed = [];
let lettersFalling = false;

let currentFish = 0; // 0 = goldfish, 1 = anglerfish
let fishCaughtCount = 0;
let caughtName = "";
let fishScale = 0;
let catchProgress = 0;
let caughtOpacity = 0;
let caughtScale = 0.7;
let statHover = [];

// This slider changes the displayed model size on the caught screen.
let specimenScale = 0.85;
let specimenSliderDragging = false;
const specimenScaleMin = 0.4;
const specimenScaleMax = 1.0;

// Timeline data is read from overfishing_europe.csv.
let overfishingData = [];
let selectedYear = 2003;
let yearSliderDragging = false;
let transitionProgress = 0;
let chartReveal = 1;

async function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  rectMode(CENTER);
  colorMode(HSB, 360, 100, 100, 100);
  textAlign(CENTER, CENTER);
  noStroke();

  // Load all assets before the sketch begins drawing.
  titleFont = await loadFont("assets/PPFormula-Medium.otf");
  goldfish = await loadModel("assets/goldfish.obj", true);
  angler = await loadModel("assets/angler.obj", true);
  catchSound = await loadSound("assets/catch.mp3");
  catchSound.amp(0.6);

  // Read the annual series from the CSV file beside this sketch.
  const table = await loadTable(
    "assets/overfishing_europe.csv",
    ",",
    "header"
  );

  for (let row = 0; row < table.getRowCount(); row++) {
    const sustainableText = table.getString(
      row,
      "sustainably_exploited_percent"
    );

    const pressureText = table.getString(
      row,
      "overfishing_pressure_proxy_percent"
    );

    overfishingData.push({
      year: table.getNum(row, "year"),
      sustainable: sustainableText === "" ? null : Number(sustainableText),
      pressure: pressureText === "" ? null : Number(pressureText),
      status: table.getString(row, "data_status")
    });
  }

  textFont(titleFont);
}

function draw() {
  drawOcean();

  if (scene === "title") {
    drawTitleScreen();
    return;
  }

  if (scene === "dataTransition") {
    drawDataTransition();
    return;
  }

  if (scene === "dataViz") {
    drawOverfishingScreen();
    return;
  }

  drawGameTitle();

  if (scene === "typing" || scene === "falling") {
    drawCatchLetters();
  }

  if (scene === "fish" || scene === "catching") {
    drawFish();
  }

  if (scene === "caught") {
    drawCaughtScreen();
  }
}

function drawOcean() {
  background("#06152A");
  noStroke();

  // Moving rows of soft points suggest a quiet underwater current.
  for (let row = 0; row < 14; row++) {
    const y = -height / 2 + row * (height / 13);

    for (let x = -width / 2; x < width / 2; x += 24) {
      const wave = sin(x * 0.012 + frameCount * 0.025 + row * 0.6);
      const dotSize = 2 + (wave + 1) * 2;

      fill(190, 55, 85, 18);
      circle(x, y + wave * 8, dotSize);
    }
  }
}

function drawTitleScreen() {
  const targetTiltY = map(mouseX, 0, width, -0.25, 0.25);
  const targetTiltX = map(mouseY, 0, height, 0.15, -0.15);

  titleTiltX = lerp(titleTiltX, targetTiltX, 0.05);
  titleTiltY = lerp(titleTiltY, targetTiltY, 0.05);

  push();
  rotateX(titleTiltX);
  rotateY(titleTiltY);

  fill(0, 0, 100);
  textFont(titleFont);
  textSize(min(width * 0.08, 100));
  text("What's the Catch?", 0, 0);
  pop();

  fill(0, 0, 90);
  textSize(18);
  text("Press space to begin", 0, height / 2 - 85);
}

function drawGameTitle() {
  fill(0, 0, 100);
  textFont(titleFont);
  textSize(min(width * 0.05, 72));
  text("What's the Catch?", 0, -height / 2 + 110);
}

function drawCatchLetters() {
  const titleY = -height / 2 + 110;
  const promptY = height / 2 - 95;
  const catchY = (titleY + promptY) / 2;

  textSize(64);
  fill(185, 45, 100);

  for (let i = 0; i < lettersShown; i++) {
    const letterX = (i - 2) * 50;
    text(catchWord[i], letterX, catchY + letterY[i]);

    // Gravity speeds up each letter's fall.
    if (lettersFalling) {
      letterSpeed[i] += 0.5;
      letterY[i] += letterSpeed[i];
    }
  }

  fill(0, 0, 85);
  textSize(16);
  text("Press space to catch something...", 0, promptY);

  // Reveal the fish once the falling letters leave the screen.
  if (lettersFalling && letterY[0] > height) {
    scene = "fish";
    fishScale = 0;
  }
}

function drawFish() {
  let fishY = 0;

  // Grow the fish into view.
  if (scene === "fish") {
    fishScale = min(fishScale + 0.03, 1.5);
  }

  // Animate the fish popping up and shrinking away when caught.
  if (scene === "catching") {
    catchProgress = min(catchProgress + 0.015, 1);
    const popProgress = min(catchProgress * 2, 1);
    fishY = -sin(popProgress * HALF_PI) * 55;

    if (catchProgress > 0.35) {
      fishScale = map(catchProgress, 0.35, 1, 1, 0);
    }

    if (catchProgress >= 1) {
      fishCaughtCount++;
      caughtOpacity = 0;
      caughtScale = 0.7;
      statHover = [];
      scene = "caught";
    }
  }

  ambientLight(0, 0, 100);
  directionalLight(0, 0, 100, -1, 1, -1);

  push();
  translate(0, fishY, 0);

  if (currentFish === 0) {
    rotateX(PI);
  } else {
    rotateZ(PI);
  }

  rotateY(frameCount * 0.02);
  scale(fishScale * 1.5);

  // Let each model use the materials referenced by its OBJ file.
  if (currentFish === 0) {
    model(goldfish);
  } else {
    model(angler);
  }

  pop();
}

function drawCaughtScreen() {
  caughtOpacity = min(caughtOpacity + 4, 100);
  caughtScale = min(caughtScale + 0.025, 1);

  // Result headline.
  push();
  scale(caughtScale);

  fill(185, 45, 100, caughtOpacity);
  textSize(min(width * 0.03, 64));
  text("You just caught:", 0, -height * 0.32);

  fill(0, 0, 100, caughtOpacity);
  textSize(32);
  text(caughtName + "!", 0, -height * 0.26);
  pop();

  const nextPrompt = fishCaughtCount < 2
    ? "Press space to catch the second fish"
    : "Press space to learn more";

  fill(0, 0, 85, caughtOpacity);
  textSize(16);
  text(nextPrompt, 0, height / 2 - 78);

  drawCaughtSpecimen();
  drawFishStats();
}

function drawCaughtSpecimen() {
  const fishX = -width * 0.29;

  ambientLight(0, 0, 100);
  directionalLight(0, 0, 100, -1, 1, -1);

  push();
  translate(fishX, 0, 0);

  if (currentFish === 0) {
    rotateX(PI);
  } else {
    rotateZ(PI);
  }

  rotateY(frameCount * 0.01);
  scale(specimenScale * 0.85);

  // Draw the selected fish model on the specimen page.
  if (currentFish === 0) {
    model(goldfish);
  } else {
    model(angler);
  }

  pop();

  drawSpecimenSlider(fishX);
}

function drawSpecimenSlider(fishX) {
  const sliderY = height * 0.28;
  const sliderWidth = min(width * 0.22, 260);
  const leftEdge = fishX - sliderWidth / 2;
  const rightEdge = fishX + sliderWidth / 2;
  const knobX = map(
    specimenScale,
    specimenScaleMin,
    specimenScaleMax,
    leftEdge,
    rightEdge
  );

  // Estimate the fish's reference length from the slider position.
  const maxLengthCm = currentFish === 0 ? 48 : 200;
  const referenceLengthCm = round(maxLengthCm * specimenScale);

  fill(0, 0, 100, caughtOpacity);
  textSize(13);
  text("REFERENCE LENGTH", fishX, sliderY - 40);

  fill(0, 0, 100, caughtOpacity);
  textSize(12);
  text(
    referenceLengthCm + " cm / " + maxLengthCm + " cm max",
    fishX,
    sliderY - 24
  );

  fill(0, 0, 45, caughtOpacity);
  rect(fishX, sliderY, sliderWidth, 6, 3);

  fill(195, 75, 95, caughtOpacity);
  rect((leftEdge + knobX) / 2, sliderY, knobX - leftEdge, 6, 3);

  fill(0, 0, 100, caughtOpacity);
  circle(knobX, sliderY, 18);

  fill(0, 0, 78, caughtOpacity);
  textSize(10);
  text(
    round(maxLengthCm * specimenScaleMin) + " cm",
    leftEdge,
    sliderY + 19
  );
  text(maxLengthCm + " cm", rightEdge, sliderY + 19);
}

function drawFishStats() {
  // Each fish gets five short facts. The population is marked unknown because
  // neither species has a reliable Europe-wide headcount.
  const facts = currentFish === 0
    ? [
        ["EUROPEAN COUNT", "No reliable total"],
        ["FOUND", "Introduced in European freshwater"],
        ["DEPTH", "0–20 m"],
        ["MAX. LENGTH", "48 cm"],
        ["MAX. WEIGHT", "1.6 kg"]
      ]
    : [
        ["EUROPEAN COUNT", "No single Europe-wide count"],
        ["FOUND", "Atlantic, Mediterranean, Black Sea"],
        ["DEPTH", "20–1,000 m"],
        ["MAX. LENGTH", "Up to 200 cm"],
        ["MAX. WEIGHT", "Up to 57.7 kg"]
      ];

  const panelWidth = min(width * 0.43, 570);
  const panelCenterX = width * 0.24;
  const leftX = panelCenterX - panelWidth / 2;
  const rowHeight = 42;
  const rowGap = 58;

  // Center the five stat rows vertically beside the fish.
  const firstY = -((facts.length - 1) * rowGap) / 2;

  if (statHover.length !== facts.length) {
    statHover = Array(facts.length).fill(0);
  }

  const mouseCanvasX = mouseX - width / 2;
  const mouseCanvasY = mouseY - height / 2;

  for (let i = 0; i < facts.length; i++) {
    const y = firstY + i * rowGap;

    const isHovered =
      mouseCanvasX >= leftX &&
      mouseCanvasX <= leftX + panelWidth &&
      mouseCanvasY >= y - rowHeight / 2 &&
      mouseCanvasY <= y + rowHeight / 2;

    statHover[i] = lerp(statHover[i], isHovered ? 1 : 0, 0.12);

    const rowColor = lerpColor(
      color("#26364B"),
      color("#4169E1"),
      statHover[i]
    );

    noStroke();
    fill(rowColor);
    rect(panelCenterX, y, panelWidth, rowHeight, 10);

    textAlign(LEFT, CENTER);
    fill(0, 0, 100, caughtOpacity);
    textSize(11);
    text(facts[i][0], leftX + 14, y);

    textAlign(RIGHT, CENTER);
    textSize(14);
    text(facts[i][1], leftX + panelWidth - 14, y);
  }

  textAlign(CENTER, CENTER);
}

function drawOverfishingScreen() {
  fill(0, 0, 100);
  textFont(titleFont);
  textSize(min(width * 0.055, 64));
  text("The cost of your catch", 0, -height * 0.40);

  fill(0, 0, 82);
  textSize(15);
  text("Fish caught faster than they can recover", 0, -height * 0.33);

  drawOverfishingChart();
  drawYearSlider();
  drawDataSourceNote();
}

function drawOverfishingChart() {
  const chartWidth = min(width * 0.76, 900);
  const left = -chartWidth / 2;
  const right = chartWidth / 2;
  const top = -height * 0.22;
  const bottom = height * 0.16;

  // Draw a quiet grid and percentage scale.
  stroke(0, 0, 100, 20);
  strokeWeight(1);

  for (let percent = 0; percent <= 100; percent += 25) {
    const y = map(percent, 0, 100, bottom, top);

    line(left, y, right, y);
    noStroke();
    fill(0, 0, 75);
    textAlign(RIGHT, CENTER);
    textSize(12);
    text(percent + "%", left - 12, y);
    stroke(0, 0, 100, 20);
  }

  // Draw the data line from left to right when the chart first appears.
  chartReveal = min(chartReveal + 0.018, 1);
  const revealYear = map(chartReveal, 0, 1, 2003, 2023);

  const observations = overfishingData.filter(
    row => row.pressure !== null && row.year <= revealYear
  );

  noFill();
  stroke(190, 70, 95);
  strokeWeight(3);
  beginShape();

  for (const row of observations) {
    const x = map(row.year, 2000, 2026, left, right);
    const y = map(row.pressure, 0, 100, bottom, top);
    vertex(x, y);
  }

  endShape();

  // The selected year gently pulses. Other data points stay still.
  noStroke();

  for (const row of observations) {
    const x = map(row.year, 2000, 2026, left, right);
    const y = map(row.pressure, 0, 100, bottom, top);

    if (row.year === selectedYear) {
      fill(45, 90, 100, 20);
      circle(x, y, 24 + sin(frameCount * 0.06) * 3);

      fill("#FFD166");
      circle(x, y, 11 + sin(frameCount * 0.06) * 2);
    } else {
      fill("#87CEFA");
      circle(x, y, 6);
    }
  }

  fill(0, 0, 75);
  textAlign(CENTER, CENTER);
  textSize(12);

  for (const year of [2000, 2005, 2010, 2015, 2020, 2026]) {
    const x = map(year, 2000, 2026, left, right);
    text(year, x, bottom + 22);
  }

  const selected = overfishingData.find(
    row => row.year === selectedYear
  );
  const valueY = top - 34;

  if (selected && selected.pressure !== null) {
    fill("#FFD166");
    textSize(30);
    text(selected.pressure + "%", 0, valueY);

    fill(0, 0, 82);
    textSize(13);
    text(
      "of overfishing above safe levels",
      0,
      valueY + 30
    );
  } else {
    fill(0, 0, 100);
    textSize(13);
    text("No observation published for " + selectedYear, 0, valueY);
  }

  textAlign(CENTER, CENTER);
}

function drawYearSlider() {
  const sliderY = height * 0.31;
  const sliderWidth = min(width * 0.76, 900);
  const left = -sliderWidth / 2;
  const right = sliderWidth / 2;
  const knobX = map(selectedYear, 2000, 2026, left, right);

  fill(0, 0, 100);
  textSize(14);
  text("OVER THE YEARS · " + selectedYear, 0, sliderY - 28);

  fill(0, 0, 45);
  rect(0, sliderY, sliderWidth, 6, 3);

  fill(190, 70, 95);
  rect((left + knobX) / 2, sliderY, knobX - left, 6, 3);

  fill("#FFD166");
  circle(knobX, sliderY, 20);

  fill(0, 0, 75);
  textSize(11);
  text("2000", left, sliderY + 22);
  text("2026", right, sliderY + 22);
}

function drawDataSourceNote() {
  fill(0, 0, 75);
  textAlign(CENTER, CENTER);
  textSize(12);
  text("Observed: 2003–2023", 0, height / 2 - 34);
  text("Unavailable: 2000–2002 and 2024–2026", 0, height / 2 - 15);
}

function drawDataTransition() {
  transitionProgress = min(transitionProgress + 0.025, 1);
  let coverAlpha;

  if (transitionProgress < 0.5) {
    // Fade the second fish's result screen down to a dark pause.
    drawGameTitle();
    drawCaughtScreen();
    coverAlpha = map(transitionProgress, 0, 0.5, 0, 100);
  } else {
    // Reveal the chart as the dark cover fades away.
    drawOverfishingScreen();
    coverAlpha = map(transitionProgress, 0.5, 1, 100, 0);
  }

  push();
  translate(0, 0, 120);
  noStroke();
  fill(220, 70, 8, coverAlpha);
  rect(0, 0, width, height);
  pop();

  if (transitionProgress >= 1) {
    scene = "dataViz";
    transitionProgress = 0;
  }
}

function updateSpecimenSlider() {
  const fishX = -width * 0.29;
  const sliderWidth = min(width * 0.22, 260);
  const mouseCanvasX = mouseX - width / 2;

  specimenScale = map(
    mouseCanvasX,
    fishX - sliderWidth / 2,
    fishX + sliderWidth / 2,
    specimenScaleMin,
    specimenScaleMax,
    true
  );
}

function updateYearSlider() {
  const sliderWidth = min(width * 0.76, 900);
  const mouseCanvasX = mouseX - width / 2;

  selectedYear = round(
    map(
      mouseCanvasX,
      -sliderWidth / 2,
      sliderWidth / 2,
      2000,
      2026,
      true
    )
  );
}

function keyPressed() {
  if (key !== " ") {
    return;
  }

  if (scene === "title") {
    scene = "typing";
    return false;
  }

  // Reveal one letter each time space is pressed.
  if (scene === "typing" && !lettersFalling) {
    if (lettersShown < catchWord.length) {
      letterY[lettersShown] = 0;
      letterSpeed[lettersShown] = 0;
      lettersShown++;
    }

    if (lettersShown === catchWord.length) {
      lettersFalling = true;
      scene = "falling";
    }

    return false;
  }

  // After fish one, begin the second round.
  // After fish two, transition to the data visualization.
  if (scene === "caught") {
    if (fishCaughtCount < 2) {
      currentFish = 1 - currentFish;
      resetCatchRound();
      scene = "typing";
    } else {
      selectedYear = 2003;
      transitionProgress = 0;
      chartReveal = 0;
      scene = "dataTransition";
    }

    return false;
  }
}

function resetCatchRound() {
  lettersShown = 0;
  letterY = [];
  letterSpeed = [];
  lettersFalling = false;
  fishScale = 0;
  catchProgress = 0;
  caughtOpacity = 0;
  caughtScale = 0.7;
  specimenScale = 0.85;
  statHover = [];
}

function mousePressed() {
  if (scene === "caught") {
    const mouseCanvasX = mouseX - width / 2;
    const mouseCanvasY = mouseY - height / 2;
    const fishX = -width * 0.29;
    const sliderWidth = min(width * 0.22, 260);
    const sliderY = height * 0.28;

    if (
      abs(mouseCanvasY - sliderY) < 20 &&
      mouseCanvasX >= fishX - sliderWidth / 2 &&
      mouseCanvasX <= fishX + sliderWidth / 2
    ) {
      specimenSliderDragging = true;
      updateSpecimenSlider();
    }

    return;
  }

  if (scene === "dataViz") {
    const mouseCanvasX = mouseX - width / 2;
    const mouseCanvasY = mouseY - height / 2;
    const sliderWidth = min(width * 0.76, 900);
    const sliderY = height * 0.31;

    if (
      abs(mouseCanvasY - sliderY) < 24 &&
      mouseCanvasX >= -sliderWidth / 2 &&
      mouseCanvasX <= sliderWidth / 2
    ) {
      yearSliderDragging = true;
      updateYearSlider();
    }

    return;
  }

  if (scene !== "fish") {
    return;
  }

  caughtName = currentFish === 0 ? "Goldfish" : "Anglerfish";

  userStartAudio();
  catchSound.play();
  catchProgress = 0;
  scene = "catching";
}

function mouseDragged() {
  if (specimenSliderDragging && scene === "caught") {
    updateSpecimenSlider();
  }

  if (yearSliderDragging && scene === "dataViz") {
    updateYearSlider();
  }
}

function mouseReleased() {
  specimenSliderDragging = false;
  yearSliderDragging = false;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
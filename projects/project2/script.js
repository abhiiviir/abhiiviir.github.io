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

// --- Bubble amount (lower = calmer) ---
const bubbleMax = 35;          // most bubbles allowed on screen at once
const trailEvery = 9;          // cursor trail: one bubble every N frames while moving
const trailMinSpeed = 6;       // mouse must move at least this fast to leave a trail
const seabedEvery = 70;        // a bubble rises from the seabed every N frames

// --- Shared "lively" state (used on every screen) ---
let bubbles = [];             // rising bubbles (cursor trail + seabed)
let ripples = [];             // expanding rings from clicks, key presses, popped bubbles
let mouseEnergy = 0;          // smoothed mouse speed, speeds up spins and bubbles
let wantHand = false;         // set by hover checks, applied at the start of the next frame
let fishLookX = 0;            // smoothed cursor position (-1 to 1), fish tilt toward it
let fishLookY = 0;
let fishSpin = 0;
let specimenSpin = 0;
let fishHover = 0;
const reactiveInfluence = {}; // per-letter cursor influence, keyed by text id

let catchWord = "CATCH";
let lettersShown = 0;
let letterY = [];
let letterSpeed = [];
let letterPop = [];
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
let specimenKnob = 18;
const specimenScaleMin = 0.4;
const specimenScaleMax = 1.0;

// Timeline data is read from overfishing_europe.csv.
let overfishingData = [];
let selectedYear = 2003;
let lastYear = 2003;
let valuePop = 0;
let yearSliderDragging = false;
let yearKnob = 20;
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
  // Hover checks from the previous frame decide the cursor.
  cursor(wantHand ? HAND : ARROW);
  wantHand = false;

  // Shared motion values that every screen can use.
  mouseEnergy = lerp(
    mouseEnergy,
    min(dist(mouseX, mouseY, pmouseX, pmouseY), 40),
    0.15
  );
  fishLookX = lerp(fishLookX, constrain((mouseX - width / 2) / (width / 2), -1, 1), 0.06);
  fishLookY = lerp(fishLookY, constrain((mouseY - height / 2) / (height / 2), -1, 1), 0.06);

  drawOcean();
  drawAmbientLife();

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

  // Give the caught message a clear focal area instead of drawing the header
  // behind it on this compact result screen.
  if (scene !== "caught") {
    drawGameTitle();
  }

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

  const mx = mouseX - width / 2;
  const my = mouseY - height / 2;

  // Moving rows of soft points suggest a quiet underwater current.
  // Points near the cursor are pushed away, grow and glow.
  for (let row = 0; row < 14; row++) {
    const y = -height / 2 + row * (height / 13);

    for (let x = -width / 2; x < width / 2; x += 24) {
      const wave = sin(x * 0.012 + frameCount * 0.025 + row * 0.6);
      let px = x;
      let py = y + wave * 8;

      const near = constrain(1 - dist(mx, my, px, py) / 150, 0, 1);

      if (near > 0) {
        const angle = atan2(py - my, px - mx);
        px += cos(angle) * near * near * 28;
        py += sin(angle) * near * near * 28;
      }

      const dotSize = 2 + (wave + 1) * 2 + near * 5;

      fill(190 - near * 10, 55 - near * 20, 85 + near * 15, 18 + near * 55);
      circle(px, py, dotSize);
    }
  }
}

// ---------- Shared lively helpers ----------

function spawnBubbles(x, y, count, spread = 10) {
  for (let i = 0; i < count; i++) {
    if (bubbles.length >= bubbleMax) break;

    bubbles.push({
      x: x + random(-spread, spread),
      y: y + random(-spread, spread) * 0.3,
      r: random(3, 8),
      speed: random(0.5, 1.5),
      wobble: random(TWO_PI),
      age: 0
    });
  }
}

function addRipple(x, y, maxR) {
  // Keep the number of rings on screen under control too.
  if (ripples.length >= 8) {
    ripples.shift();
  }

  ripples.push({ x: x, y: y, r: 0, maxR: maxR });
}

function drawAmbientLife() {
  const mx = mouseX - width / 2;
  const my = mouseY - height / 2;

  // A sparse bubble trail behind a moving cursor.
  if (mouseEnergy > trailMinSpeed && frameCount % trailEvery === 0) {
    spawnBubbles(mx, my, 1, 10);
  }

  // A few bubbles always rise from the seabed.
  if (frameCount % seabedEvery === 0) {
    spawnBubbles(random(-width / 2, width / 2), height / 2 + 10, 1, 0);
  }

  noFill();
  strokeWeight(1.5);

  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i];
    b.age++;
    b.y -= b.speed;
    b.x += sin(frameCount * 0.05 + b.wobble) * 0.4;

    // Touch a bubble with the cursor and it pops (smaller touch area, no ring).
    if (b.age > 40 && dist(mx, my, b.x, b.y) < b.r + 8) {
      bubbles.splice(i, 1);
      continue;
    }

    // Fade out as they rise, softer than before.
    const alpha = map(b.y, height / 2, -height / 2, 45, 0, true);
    stroke(185, 30, 100, alpha);
    circle(b.x, b.y, b.r * 2);

    if (b.y < -height / 2 - 20) {
      bubbles.splice(i, 1);
    }
  }

  for (let i = ripples.length - 1; i >= 0; i--) {
    const rp = ripples[i];
    rp.r += (rp.maxR - rp.r) * 0.08 + 0.6;

    const alpha = map(rp.r, 0, rp.maxR, 45, 0, true);

    if (alpha <= 1) {
      ripples.splice(i, 1);
      continue;
    }

    strokeWeight(2);
    stroke(185, 30, 100, alpha);
    circle(rp.x, rp.y, rp.r * 2);
  }

  noStroke();
}

// Draws a line of text where every letter drifts on its own wave and reacts
// to the cursor: it is pushed away, moves toward the viewer, grows, tilts and
// fades toward aqua. `strength` scales how strong the reaction is.
function drawReactiveText(id, str, cx, cy, size, hue, sat, bri, alpha = 100, strength = 1) {
  textFont(titleFont);
  textSize(size);
  textAlign(CENTER, CENTER);

  const widths = [];
  let totalWidth = 0;

  for (const ch of str) {
    const w = textWidth(ch);
    widths.push(w);
    totalWidth += w;
  }

  if (!reactiveInfluence[id] || reactiveInfluence[id].length !== str.length) {
    reactiveInfluence[id] = Array(str.length).fill(0);
  }

  const influence = reactiveInfluence[id];
  const mx = mouseX - width / 2;
  const my = mouseY - height / 2;
  const reach = size * 2.2;
  let cursorX = cx - totalWidth / 2;

  noStroke();

  for (let i = 0; i < str.length; i++) {
    const x = cursorX + widths[i] / 2;
    cursorX += widths[i];

    if (str[i] === " ") continue;

    const d = dist(mx, my, x, cy);
    const target = constrain(1 - d / reach, 0, 1);
    influence[i] = lerp(influence[i], target, 0.12);
    const inf = influence[i];

    // Gentle bobbing, like floating in water.
    const bobY = sin(frameCount * 0.04 + i * 0.55) * size * 0.07 * min(strength, 1);

    // Push away from the cursor and toward the viewer.
    let pushX = 0;
    let pushY = 0;

    if (d > 1) {
      pushX = ((x - mx) / d) * inf * inf * 45 * strength;
      pushY = ((cy - my) / d) * inf * inf * 45 * strength;
    }

    push();
    translate(x + pushX, cy + bobY + pushY, inf * 90 * strength);
    rotateZ(sin(frameCount * 0.05 + i) * inf * 0.35);
    scale(1 + inf * 0.25);

    const h = sat < 1 ? 185 : lerp(hue, 185, inf);
    fill(h, lerp(sat, max(sat, 45), inf), bri, alpha);
    textSize(size);
    text(str[i], 0, 0);
    pop();
  }

  textAlign(CENTER, CENTER);
}

// A prompt line that gently breathes and floats.
function drawPromptText(str, y, size = 16, alpha = 90) {
  noStroke();
  fill(0, 0, 88, alpha * (0.75 + 0.25 * sin(frameCount * 0.07)));
  textFont(titleFont);
  textSize(size);
  textAlign(CENTER, CENTER);
  text(str, 0, y + sin(frameCount * 0.05) * 3);
}

// ---------- Title and header ----------

function drawTitleScreen() {
  const targetTiltY = map(mouseX, 0, width, -0.25, 0.25);
  const targetTiltX = map(mouseY, 0, height, 0.15, -0.15);

  titleTiltX = lerp(titleTiltX, targetTiltX, 0.05);
  titleTiltY = lerp(titleTiltY, targetTiltY, 0.05);

  push();
  rotateX(titleTiltX);
  rotateY(titleTiltY);
  drawReactiveText(
    "title",
    "What's the Catch?",
    0,
    0,
    min(width * 0.08, 100),
    0, 0, 100
  );
  pop();

  drawPromptText("Press space to begin", height / 2 - 85, 18);
}

function drawGameTitle() {
  drawReactiveText(
    "header",
    "What's the Catch?",
    0,
    -height / 2 + 110,
    min(width * 0.05, 72),
    0, 0, 100,
    100,
    0.7
  );
}

// ---------- CATCH letters ----------

function catchLettersY() {
  const titleY = -height / 2 + 110;
  const promptY = height / 2 - 95;
  return (titleY + promptY) / 2;
}

function drawCatchLetters() {
  const promptY = height / 2 - 95;
  const catchY = catchLettersY();
  const mx = mouseX - width / 2;
  const my = mouseY - height / 2;

  textFont(titleFont);
  textSize(64);
  noStroke();

  for (let i = 0; i < lettersShown; i++) {
    const letterX = (i - 2) * 50;
    const bob = lettersFalling ? 0 : sin(frameCount * 0.07 + i * 0.8) * 5;
    const baseY = catchY + letterY[i] + bob;

    // Cursor proximity and the pop from being typed both animate the letter.
    const inf = constrain(1 - dist(mx, my, letterX, baseY) / 110, 0, 1);
    letterPop[i] = max(0, (letterPop[i] || 0) - 0.04);
    const popAmount = letterPop[i];

    // Letters tumble as they fall.
    const tumble = lettersFalling ? letterSpeed[i] * 0.02 * (i % 2 === 0 ? 1 : -1) : 0;

    push();
    translate(letterX, baseY - inf * 10, inf * 60 + popAmount * 40);
    rotateZ(sin(frameCount * 0.06 + i) * inf * 0.3 + tumble);
    scale(1 + inf * 0.25 + popAmount * 0.6);
    fill(185, lerp(45, 15, inf), 100);
    textSize(64);
    text(catchWord[i], 0, 0);
    pop();

    // Gravity speeds up each letter's fall.
    if (lettersFalling) {
      letterSpeed[i] += 0.5;
      letterY[i] += letterSpeed[i];
    }
  }

  drawPromptText("Press space to catch something...", promptY, 16, 85);

  // Reveal the fish once the falling letters leave the screen.
  if (lettersFalling && letterY[0] > height) {
    scene = "fish";
    fishScale = 0;
  }
}

// ---------- Fish ----------

function drawFish() {
  let fishY = 0;
  const mx = mouseX - width / 2;
  const my = mouseY - height / 2;

  // Grow the fish into view, floating gently while it waits to be caught.
  if (scene === "fish") {
    fishScale = min(fishScale + 0.03, 1.5);
    fishY = sin(frameCount * 0.05) * 10;
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

  // The fish swells slightly and the cursor becomes a hand when hovering it.
  const overFish = scene === "fish" && dist(mx, my, 0, 0) < 190;
  fishHover = lerp(fishHover, overFish ? 1 : 0, 0.12);

  if (overFish) {
    wantHand = true;
  }

  if (scene === "fish" && fishScale >= 1.4) {
    drawPromptText("Click the fish to catch it", height / 2 - 95, 16, 85);
  }

  // The fish spins faster when the mouse moves.
  fishSpin += 0.02 + mouseEnergy * 0.003;

  ambientLight(0, 0, 100);
  directionalLight(0, 0, 100, -1, 1, -1);

  push();
  translate(mx * 0.05, fishY, 0);

  // Lean toward the cursor.
  rotateX(fishLookY * 0.3);
  rotateZ(-fishLookX * 0.2);

  if (currentFish === 0) {
    rotateX(PI);
  } else {
    rotateZ(PI);
  }

  rotateY(fishSpin);
  scale(fishScale * 1.5 * (1 + fishHover * 0.08));

  // Let each model use the materials referenced by its OBJ file.
  if (currentFish === 0) {
    model(goldfish);
  } else {
    model(angler);
  }

  pop();
}

// ---------- Caught screen ----------

function drawCaughtScreen() {
  caughtOpacity = min(caughtOpacity + 4, 100);
  caughtScale = min(caughtScale + 0.025, 1);

  // Keep the catch announcement at the top of the specimen screen.
  const headlineY = -height / 2 + (height < 520 ? 82 : 80);

  push();
  scale(caughtScale);

  drawReactiveText(
    "caughtLabel",
    "You just caught:",
    0,
    headlineY,
    min(width * 0.04, height < 520 ? 30 : 42),
    185, 45, 100,
    caughtOpacity,
    0.6
  );

  drawReactiveText(
    "caughtName",
    caughtName + "!",
    0,
    headlineY + (height < 520 ? 34 : 60),
    height < 520 ? 24 : 32,
    0, 0, 100,
    caughtOpacity,
    0.6
  );
  pop();

  const nextPrompt = fishCaughtCount < 2
    ? "Press space to catch the second fish"
    : "Press space to learn more";

  drawPromptText(
    nextPrompt,
    height / 2 - (height < 520 ? 18 : 78),
    16,
    caughtOpacity * 0.85
  );

  drawCaughtSpecimen();
  drawFishStats();
}

function drawCaughtSpecimen() {
  const fishX = -width * 0.29;

  // The specimen turns faster with mouse movement and leans toward the cursor.
  specimenSpin += 0.01 + mouseEnergy * 0.002;

  ambientLight(0, 0, 100);
  directionalLight(0, 0, 100, -1, 1, -1);

  push();
  translate(fishX, sin(frameCount * 0.03) * 8, 0);
  rotateX(fishLookY * 0.25);
  rotateZ(-fishLookX * 0.15);

  if (currentFish === 0) {
    rotateX(PI);
  } else {
    rotateZ(PI);
  }

  rotateY(specimenSpin);
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

  // The knob grows when hovered and more when dragged.
  const mx = mouseX - width / 2;
  const my = mouseY - height / 2;
  const hovering =
    abs(my - sliderY) < 20 && mx >= leftEdge && mx <= rightEdge;

  if (hovering || specimenSliderDragging) {
    wantHand = true;
  }

  specimenKnob = lerp(
    specimenKnob,
    specimenSliderDragging ? 28 : hovering ? 23 : 18,
    0.2
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

  fill(195, 60, 100, caughtOpacity * 0.2);
  circle(knobX, sliderY, specimenKnob + 12);

  fill(0, 0, 100, caughtOpacity);
  circle(knobX, sliderY, specimenKnob);

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
  const compactLayout = height < 520;
  const rowHeight = compactLayout ? 34 : 42;
  const rowGap = compactLayout ? 44 : 58;

  // Center the rows beside the fish, leaving room above for the catch heading.
  const compactOffset = compactLayout ? 45 : 0;
  const firstY = -((facts.length - 1) * rowGap) / 2 + compactOffset;

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

    // A hovered row slides toward the fish and lifts slightly.
    const slide = statHover[i] * 10;

    push();
    translate(0, 0, statHover[i] * 8);
    noStroke();
    fill(rowColor);
    rect(panelCenterX + slide, y, panelWidth, rowHeight, 10);

    textAlign(LEFT, CENTER);
    fill(0, 0, 100, caughtOpacity);
    textSize(11);
    text(facts[i][0], leftX + 14 + slide, y);

    textAlign(RIGHT, CENTER);
    textSize(14);
    text(facts[i][1], leftX + panelWidth - 14 + slide, y);
    pop();
  }

  textAlign(CENTER, CENTER);
}

// ---------- Data screen ----------

function drawOverfishingScreen() {
  drawReactiveText(
    "cost",
    "The Cost Of Your Catch",
    0,
    -height * 0.40,
    min(width * 0.055, 64),
    0, 0, 100,
    100,
    0.6
  );

  drawOverfishingChart();
  drawYearSlider();
  drawDataSourceNote();
}

function chartBounds() {
  const chartWidth = min(width * 0.76, 900);

  return {
    left: -chartWidth / 2,
    right: chartWidth / 2,
    top: -height * 0.22,
    bottom: height * 0.16
  };
}

function drawOverfishingChart() {
  const { left, right, top, bottom } = chartBounds();
  const mx = mouseX - width / 2;
  const my = mouseY - height / 2;

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

  // A soft glow under the line, then the line itself.
  noFill();
  stroke(190, 70, 95, 15);
  strokeWeight(10);
  beginShape();

  for (const row of observations) {
    vertex(
      map(row.year, 2000, 2026, left, right),
      map(row.pressure, 0, 100, bottom, top)
    );
  }

  endShape();

  stroke(190, 70, 95);
  strokeWeight(3);
  beginShape();

  for (const row of observations) {
    vertex(
      map(row.year, 2000, 2026, left, right),
      map(row.pressure, 0, 100, bottom, top)
    );
  }

  endShape();

  // Points swell as the cursor approaches, like a magnifier.
  // The selected year gently pulses.
  noStroke();

  let nearest = null;
  let nearestDist = Infinity;
  let nearestX = 0;
  let nearestY = 0;

  for (const row of observations) {
    const x = map(row.year, 2000, 2026, left, right);
    const y = map(row.pressure, 0, 100, bottom, top);
    const d = dist(mx, my, x, y);
    const near = constrain(1 - d / 70, 0, 1);

    if (d < nearestDist) {
      nearestDist = d;
      nearest = row;
      nearestX = x;
      nearestY = y;
    }

    if (row.year === selectedYear) {
      fill(45, 90, 100, 20);
      circle(x, y, 24 + sin(frameCount * 0.06) * 3 + near * 8);

      fill("#FFD166");
      circle(x, y, 11 + sin(frameCount * 0.06) * 2 + near * 7);
    } else {
      fill(203, 46 - near * 36, 100);
      circle(x, y, 6 + near * 9);
    }
  }

  // Tooltip for the closest point. Clicking it selects that year.
  if (nearest && nearestDist < 26) {
    wantHand = true;

    fill(220, 60, 25, 92);
    rect(nearestX, nearestY - 34, 96, 28, 8);

    fill(0, 0, 100);
    textAlign(CENTER, CENTER);
    textSize(12);
    text(nearest.year + " · " + nearest.pressure + "%", nearestX, nearestY - 34);
  }

  fill(0, 0, 75);
  textAlign(CENTER, CENTER);
  textSize(12);

  for (const year of [2000, 2005, 2010, 2015, 2020, 2026]) {
    const x = map(year, 2000, 2026, left, right);
    text(year, x, bottom + 22);
  }

  // The big number pops whenever the selected year changes.
  if (selectedYear !== lastYear) {
    valuePop = 1;
    lastYear = selectedYear;
  }

  valuePop *= 0.9;

  const selected = overfishingData.find(
    row => row.year === selectedYear
  );
  // Lift the selected percentage clear of the chart and give it a subtle pulse.
  const valueY = top - 74;

  if (selected && selected.pressure !== null) {
    const valuePulse = sin(frameCount * 0.05);
    noStroke();
    fill(45, 90, 100, 12 + valuePop * 20);
    circle(0, valueY, 78 + valuePulse * 8 + valuePop * 30);

    fill("#FFD166");
    textSize(28 + valuePulse * 2 + valuePop * 12);
    text(selected.pressure + "%", 0, valueY);

    fill(0, 0, 82);
    textSize(13);
    text(
      "of overfishing above safe levels",
      0,
      valueY + 38
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

  const mx = mouseX - width / 2;
  const my = mouseY - height / 2;
  const hovering = abs(my - sliderY) < 24 && mx >= left && mx <= right;

  if (hovering || yearSliderDragging) {
    wantHand = true;
  }

  yearKnob = lerp(
    yearKnob,
    yearSliderDragging ? 30 : hovering ? 25 : 20,
    0.2
  );

  fill(0, 0, 100);
  textSize(14);
  text("YEAR · " + selectedYear, 0, sliderY - 28);

  fill(0, 0, 45);
  rect(0, sliderY, sliderWidth, 6, 3);

  fill(190, 70, 95);
  rect((left + knobX) / 2, sliderY, knobX - left, 6, 3);

  fill(45, 90, 100, 18);
  circle(knobX, sliderY, yearKnob + 14 + sin(frameCount * 0.08) * 3);

  fill("#FFD166");
  circle(knobX, sliderY, yearKnob);

  fill(0, 0, 75);
  textSize(11);
  text("2000", left, sliderY + 22);
  text("2026", right, sliderY + 22);
}

function drawDataSourceNote() {
  fill(0, 0, 75);
  textAlign(CENTER, CENTER);
  textSize(12);
  text("Data recorded from 2003 to 2023.", 0, height / 2 - 24);
}

function drawDataTransition() {
  transitionProgress = min(transitionProgress + 0.025, 1);
  let coverAlpha;

  if (transitionProgress < 0.5) {
    // Fade the second fish's result screen down to a dark pause.
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

  // Every space press sends one soft ripple and a couple of bubbles.
  addRipple(0, 0, 220);
  spawnBubbles(0, height / 2, 3, width * 0.3);

  if (scene === "title") {
    scene = "typing";
    return false;
  }

  // Reveal one letter each time space is pressed.
  if (scene === "typing" && !lettersFalling) {
    if (lettersShown < catchWord.length) {
      letterY[lettersShown] = 0;
      letterSpeed[lettersShown] = 0;
      letterPop[lettersShown] = 1;
      spawnBubbles((lettersShown - 2) * 50, catchLettersY(), 2, 15);
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
  letterPop = [];
  lettersFalling = false;
  fishScale = 0;
  catchProgress = 0;
  caughtOpacity = 0;
  caughtScale = 0.7;
  specimenScale = 0.85;
  statHover = [];
}

function mousePressed() {
  // Every click makes a ripple and one or two bubbles.
  addRipple(mouseX - width / 2, mouseY - height / 2, 90);
  spawnBubbles(mouseX - width / 2, mouseY - height / 2, 2, 8);

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
      return;
    }

    // Clicking a data point on the chart selects that year.
    const { left, right, top, bottom } = chartBounds();

    for (const row of overfishingData) {
      if (row.pressure === null) continue;

      const x = map(row.year, 2000, 2026, left, right);
      const y = map(row.pressure, 0, 100, bottom, top);

      if (dist(mouseCanvasX, mouseCanvasY, x, y) < 20) {
        selectedYear = row.year;
        break;
      }
    }

    return;
  }

  if (scene !== "fish") {
    return;
  }

  caughtName = currentFish === 0 ? "Goldfish" : "Anglerfish";

  // Splash when the fish is caught.
  addRipple(0, 0, 260);
  spawnBubbles(0, 0, 8, 60);

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
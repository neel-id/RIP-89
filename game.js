(function () {
  "use strict";

  var canvas = document.getElementById("game");
  var ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  var W = canvas.width;
  var H = canvas.height;
  var RED = "#e01b2e";
  var WHITE = "#ffffff";
  var GREEN = "#00ff41";
  var DARK_GRID = "#171717";
  var GRID = "#242424";
  var PINK = "#cc3366";
  var MAROON = "#7d111f";
  var CRIMSON = "#b00018";
  var falconAsset = createFalconAsset();

  var keys = {};
  var audioCtx = null;
  var lastTime = performance.now();
  var state = "title";
  var tick = 0;
  var highScore = Number(localStorage.getItem("otofHighScore") || 0);

  var player;
  var enemies;
  var enemyDir;
  var enemyStepTimer;
  var enemyShotTimer;
  var playerShots;
  var enemyShots;
  var barriers;
  var score;
  var lives;
  var flashText;
  var explosions;
  var backgroundDigits = createBackgroundDigits();

  function makePlayer() {
    return {
      x: W / 2 - 14,
      y: H - 38,
      w: 28,
      h: 18,
      speed: 142,
      cooldown: 0,
      invulnerable: 1.2
    };
  }

  function resetGame() {
    player = makePlayer();
    enemies = [];
    enemyDir = 1;
    enemyStepTimer = 0;
    enemyShotTimer = 0.84;
    playerShots = [];
    enemyShots = [];
    barriers = createBarriers();
    score = 0;
    lives = 3;
    flashText = "";
    explosions = [];

    var cols = 8;
    var startX = 55;
    var gapX = 46;
    var rows = [
      { name: "SCATTERED SPIDER", kind: "spider", points: 10, y: 72, color: PINK },
      { name: "FANCY BEAR", kind: "fancyBear", points: 20, y: 112, color: MAROON },
      { name: "COZY BEAR", kind: "cozyBear", points: 40, y: 152, color: CRIMSON }
    ];

    for (var r = 0; r < rows.length; r += 1) {
      for (var c = 0; c < cols; c += 1) {
        enemies.push({
          x: startX + c * gapX,
          y: rows[r].y,
          w: 26,
          h: 20,
          row: r,
          col: c,
          alive: true,
          kind: rows[r].kind,
          label: rows[r].name,
          points: rows[r].points,
          color: rows[r].color,
          jitter: Math.random() * 10
        });
      }
    }
  }

  function createBarriers() {
    var result = [];
    var centers = [96, 192, 288, 384];
    for (var i = 0; i < centers.length; i += 1) {
      var chunks = [];
      var originX = centers[i] - 24;
      var originY = H - 92;
      var pattern = [
        [0, 1, 1, 1, 1, 0],
        [1, 1, 1, 1, 1, 1],
        [1, 1, 0, 0, 1, 1],
        [1, 1, 0, 0, 1, 1]
      ];
      for (var y = 0; y < pattern.length; y += 1) {
        for (var x = 0; x < pattern[y].length; x += 1) {
          if (pattern[y][x]) {
            chunks.push({
              x: originX + x * 8,
              y: originY + y * 7,
              w: 7,
              h: 6,
              hp: 2
            });
          }
        }
      }
      result.push({ chunks: chunks });
    }
    return result;
  }

  function createBackgroundDigits() {
    var digits = [];
    for (var y = 12; y < H; y += 14) {
      for (var x = 8; x < W; x += 14) {
        var seed = (x * 17 + y * 31) % 11;
        digits.push({
          x: x + (seed % 3),
          y: y,
          glyph: seed % 2 === 0 ? "1" : "0",
          color: seed % 5 === 0 ? "rgba(224,27,46,0.1)" : "rgba(255,255,255,0.08)"
        });
      }
    }
    return digits;
  }

  function createFalconAsset() {
    var image = new Image();
    var state = {
      image: image,
      ready: false,
      canvas: null
    };

    image.onload = function () {
      var offscreen = document.createElement("canvas");
      offscreen.width = image.width;
      offscreen.height = image.height;
      var offCtx = offscreen.getContext("2d");
      offCtx.drawImage(image, 0, 0);
      var pixels = offCtx.getImageData(0, 0, offscreen.width, offscreen.height);
      for (var i = 0; i < pixels.data.length; i += 4) {
        if (pixels.data[i] < 18 && pixels.data[i + 1] < 18 && pixels.data[i + 2] < 18) {
          pixels.data[i + 3] = 0;
        }
      }
      offCtx.putImageData(pixels, 0, 0);
      state.canvas = offscreen;
      state.ready = true;
    };

    image.src = "falcon.png";
    return state;
  }

  function startGame() {
    initAudio();
    resetGame();
    state = "playing";
    playTone(520, 0.06, "square", 0.04);
    setTimeout(function () {
      playTone(780, 0.06, "square", 0.04);
    }, 70);
  }

  function initAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
  }

  function playTone(freq, duration, type, gainValue) {
    if (!audioCtx) return;
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.type = type || "square";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(gainValue || 0.05, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  }

  function rectsOverlap(a, b) {
    if (!a || !b) return false;
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function aliveEnemies() {
    return enemies.filter(function (enemy) {
      return enemy.alive;
    });
  }

  function update(dt) {
    tick += dt;
    if (state !== "playing") return;

    var movingLeft = keys.ArrowLeft || keys.KeyA || keys.Numpad4;
    var movingRight = keys.ArrowRight || keys.KeyD || keys.Numpad6;
    var firing = keys.Space || keys.KeyZ || keys.KeyX || keys.ControlLeft || keys.ControlRight;

    if (movingLeft) player.x -= player.speed * dt;
    if (movingRight) player.x += player.speed * dt;
    player.x = Math.max(8, Math.min(W - player.w - 8, player.x));
    player.cooldown = Math.max(0, player.cooldown - dt);
    player.invulnerable = Math.max(0, player.invulnerable - dt);

    if (firing && player.cooldown <= 0 && playerShots.length < 4) {
      playerShots.push({ x: player.x + player.w / 2 - 1, y: player.y - 8, w: 2, h: 8, speed: 248 });
      player.cooldown = 0.11;
      playTone(1040, 0.04, "square", 0.035);
    }

    for (var p = playerShots.length - 1; p >= 0; p -= 1) {
      playerShots[p].y -= playerShots[p].speed * dt;
      if (playerShots[p].y < -10) {
        playerShots.splice(p, 1);
      }
    }

    for (var s = enemyShots.length - 1; s >= 0; s -= 1) {
      enemyShots[s].y += enemyShots[s].speed * dt;
      if (enemyShots[s].y > H + 8) {
        enemyShots.splice(s, 1);
      }
    }

    moveEnemies(dt);
    fireEnemyShot(dt);
    updateCollisions();
    updateExplosions(dt);
    checkEndStates();
  }

  function moveEnemies(dt) {
    var living = aliveEnemies();
    if (!living.length) return;

    var speedFactor = 1 + (24 - living.length) * 0.055;
    enemyStepTimer += dt * speedFactor;
    if (enemyStepTimer < 0.28) return;
    enemyStepTimer = 0;

    var minX = Infinity;
    var maxX = -Infinity;
    for (var i = 0; i < living.length; i += 1) {
      minX = Math.min(minX, living[i].x);
      maxX = Math.max(maxX, living[i].x + living[i].w);
    }

    var hitEdge = (enemyDir > 0 && maxX >= W - 18) || (enemyDir < 0 && minX <= 18);
    var dx = enemyDir * (7 + Math.min(8, speedFactor * 1.5));
    var dy = 0;

    if (hitEdge) {
      enemyDir *= -1;
      dx = 0;
      dy = 11;
      playTone(150, 0.08, "sawtooth", 0.025);
    } else {
      playTone(210 + living.length * 3, 0.03, "square", 0.015);
    }

    for (var e = 0; e < living.length; e += 1) {
      living[e].x += dx;
      living[e].y += dy;
      if (living[e].kind === "spider") {
        living[e].x += Math.sin(tick * 9 + living[e].jitter) * 0.8;
      }
    }
  }

  function fireEnemyShot(dt) {
    enemyShotTimer -= dt;
    if (enemyShotTimer > 0) return;

    var living = aliveEnemies();
    if (!living.length) return;

    var columns = {};
    for (var i = 0; i < living.length; i += 1) {
      var key = living[i].col;
      if (!columns[key] || living[i].y > columns[key].y) {
        columns[key] = living[i];
      }
    }

    var shooters = Object.keys(columns).map(function (key) {
      return columns[key];
    });
    var burstCount = living.length < 10 ? 4 : living.length < 18 ? 3 : 2;
    burstCount = Math.min(burstCount, shooters.length, Math.max(0, 10 - enemyShots.length));

    for (var s = 0; s < burstCount; s += 1) {
      var shooterIndex = Math.floor(Math.random() * shooters.length);
      var shooter = shooters.splice(shooterIndex, 1)[0];
      enemyShots.push({
        x: shooter.x + shooter.w / 2 - 3,
        y: shooter.y + shooter.h,
        w: 6,
        h: 7,
        speed: 84 + Math.random() * 34,
        glyph: Math.random() > 0.5 ? "1" : "0"
      });
    }

    enemyShotTimer = Math.max(0.26, 0.72 - (24 - living.length) * 0.014 + Math.random() * 0.22);
    playTone(330, 0.04, "triangle", 0.025);
  }

  function updateCollisions() {
    for (var p = playerShots.length - 1; p >= 0; p -= 1) {
      var playerShot = playerShots[p];
      for (var i = 0; i < enemies.length; i += 1) {
        var enemy = enemies[i];
        if (enemy.alive && rectsOverlap(playerShot, enemy)) {
          enemy.alive = false;
          score += enemy.points;
          makeExplosion(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, enemy.color);
          playerShots.splice(p, 1);
          playTone(90 + enemy.points * 8, 0.09, "square", 0.055);
          break;
        }
      }

      if (!playerShots[p]) {
        continue;
      }

      if (hitBarrier(playerShots[p], 1)) {
        playerShots.splice(p, 1);
      }
    }

    for (var s = enemyShots.length - 1; s >= 0; s -= 1) {
      var shot = enemyShots[s];
      if (!shot) {
        continue;
      }

      if (hitBarrier(shot, 1)) {
        enemyShots.splice(s, 1);
        continue;
      }

      if (player.invulnerable <= 0 && rectsOverlap(shot, player)) {
        enemyShots.splice(s, 1);
        loseLife();
        return;
      }
    }
  }

  function hitBarrier(projectile, damage) {
    for (var b = 0; b < barriers.length; b += 1) {
      var chunks = barriers[b].chunks;
      for (var c = chunks.length - 1; c >= 0; c -= 1) {
        var chunk = chunks[c];
        if (rectsOverlap(projectile, chunk)) {
          chunk.hp -= damage;
          if (chunk.hp <= 0) chunks.splice(c, 1);
          return true;
        }
      }
    }
    return false;
  }

  function loseLife() {
    lives -= 1;
    makeExplosion(player.x + player.w / 2, player.y + player.h / 2, RED);
    playTone(120, 0.18, "sawtooth", 0.075);
    player = makePlayer();
    player.invulnerable = 1.45;
    playerShots = [];
    enemyShots = [];
    enemyShotTimer = 0.92;
    if (lives <= 0) {
      state = "gameover";
      flashText = "BREACH DETECTED";
      saveHighScore();
      playFailSound();
    }
  }

  function makeExplosion(x, y, color) {
    explosions.push({ x: x, y: y, color: color, life: 0.28, maxLife: 0.28 });
  }

  function updateExplosions(dt) {
    for (var i = explosions.length - 1; i >= 0; i -= 1) {
      explosions[i].life -= dt;
      if (explosions[i].life <= 0) explosions.splice(i, 1);
    }
  }

  function checkEndStates() {
    var living = aliveEnemies();
    if (!living.length) {
      state = "win";
      flashText = "ADVERSARY STOPPED";
      saveHighScore();
      playWinSound();
      return;
    }

    for (var i = 0; i < living.length; i += 1) {
      if (living[i].y + living[i].h >= player.y - 8) {
        lives = 0;
        state = "gameover";
        flashText = "BREACH DETECTED";
        saveHighScore();
        playFailSound();
        return;
      }
    }
  }

  function saveHighScore() {
    if (score > highScore) {
      highScore = score;
      localStorage.setItem("otofHighScore", String(highScore));
    }
  }

  function playWinSound() {
    [480, 640, 820, 1060].forEach(function (freq, i) {
      setTimeout(function () {
        playTone(freq, 0.11, "square", 0.05);
      }, i * 105);
    });
  }

  function playFailSound() {
    [360, 230, 150, 90].forEach(function (freq, i) {
      setTimeout(function () {
        playTone(freq, 0.12, "sawtooth", 0.055);
      }, i * 105);
    });
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawBackground();

    if (state === "title") {
      drawTitle();
    } else if (state === "briefing") {
      drawBriefing();
    } else {
      drawHud();
      drawBarriers();
      drawEnemies();
      drawPlayer();
      drawProjectiles();
      drawExplosions();

      if (state === "win") {
        drawWinScreen();
      } else if (state === "gameover") {
        drawEndScreen("BREACH DETECTED", "MISSION FAILED", RED);
      }
    }
  }

  function drawBackground() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    for (var i = 0; i < backgroundDigits.length; i += 1) {
      var digit = backgroundDigits[i];
      drawPixelText(digit.glyph, digit.x, digit.y, 1, digit.color);
    }
  }

  function drawTitle() {
    drawCrowdStrikeLogo(W / 2 - 84, 22, 166, 105, 1);
    drawCenteredPixelText("ONE TEAM", 126, 5, WHITE);
    drawCenteredPixelText("ONE FIGHT", 168, 5, RED);
    drawCenteredPixelText("GOOD GUYS VS BAD GUYS", 220, 2, GREEN);
    drawCenteredPixelText("FOR J.C. HERRERA", 246, 1, "#9f9f9f");
    if (Math.floor(tick * 2) % 2 === 0) {
      drawCenteredPixelText("PRESS START", 274, 1, GREEN);
    }
  }

  function drawBriefing() {
    drawCrowdStrikeLogo(W / 2 - 66, 30, 133, 82, 0.42);
    drawCenteredPixelText("HOW MANY CAN YOU STOP?", 132, 2, WHITE);
    drawCenteredPixelText("DEFEND THE GOOD GUYS", 168, 1, GREEN);
    drawCenteredPixelText("HOLD FIRE TO DEFEND", 214, 1, "#d4d4d4");
    if (Math.floor(tick * 2) % 2 === 0) {
      drawCenteredPixelText("PRESS START", 236, 1, GREEN);
    }
  }

  function drawHud() {
    drawPixelText("SCORE " + pad(score, 4), 8, 8, 1, WHITE);
    drawPixelText("HI " + pad(highScore, 4), 204, 8, 1, "#888");
    drawPixelText("LIVES", 378, 8, 1, WHITE);
    for (var i = 0; i < lives; i += 1) {
      drawFalconIcon(430 + i * 15, 8, RED);
    }
  }

  function drawPlayer() {
    if (player.invulnerable > 0 && Math.floor(tick * 12) % 2 === 0) {
      return;
    }
    drawPlayerShip(player.x, player.y, player.w, player.h, RED);
  }

  function drawFalconIcon(x, y, color) {
    drawPlayerShip(x, y + 2, 12, 8, color);
  }

  function drawPlayerShip(x, y, w, h, color) {
    ctx.fillStyle = color;
    var sx = w / 28;
    var sy = h / 18;
    px(x, y, sx, sy, [
      [12, 0, 4, 2],
      [9, 2, 10, 2],
      [5, 4, 18, 3],
      [1, 7, 26, 3],
      [0, 10, 9, 3],
      [19, 10, 9, 3],
      [10, 10, 8, 5],
      [12, 15, 4, 3]
    ]);
    ctx.fillStyle = "#ffffff";
    px(x, y, sx, sy, [
      [13, 2, 2, 2],
      [12, 6, 4, 1],
      [11, 11, 6, 1]
    ]);
  }

  function drawCrowdStrikeLogo(x, y, w, h, alpha) {
    if (falconAsset.ready && falconAsset.canvas) {
      ctx.save();
      ctx.globalAlpha = alpha == null ? 1 : alpha;
      ctx.drawImage(falconAsset.canvas, x, y, w, h);
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = RED;
    var sx = w / 58;
    var sy = h / 42;
    px(x, y, sx, sy, [
      [2, 2, 3, 4],
      [4, 6, 4, 5],
      [6, 11, 5, 5],
      [9, 16, 6, 5],
      [13, 21, 7, 5],
      [17, 26, 8, 5],
      [21, 31, 8, 5],
      [10, 8, 3, 4],
      [12, 12, 4, 5],
      [15, 17, 5, 5],
      [19, 22, 6, 5],
      [23, 27, 6, 5],
      [27, 31, 5, 4],
      [11, 22, 3, 3],
      [14, 25, 5, 4],
      [18, 29, 5, 4],
      [22, 33, 4, 3],
      [20, 10, 12, 4],
      [24, 14, 12, 4],
      [28, 18, 12, 4],
      [31, 22, 12, 4],
      [34, 26, 12, 4],
      [36, 30, 12, 4],
      [39, 34, 11, 4],
      [42, 38, 9, 3],
      [33, 12, 6, 18],
      [39, 14, 6, 18],
      [45, 20, 5, 16],
      [48, 25, 4, 12],
      [37, 35, 7, 4],
      [43, 36, 5, 4],
      [42, 39, 4, 3],
      [34, 36, 3, 3]
    ]);
    ctx.fillStyle = WHITE;
    px(x, y, sx, sy, [
      [19, 13, 3, 4],
      [21, 17, 3, 4],
      [23, 21, 3, 4],
      [25, 25, 3, 4],
      [27, 29, 3, 4],
      [29, 33, 3, 4],
      [22, 15, 2, 18],
      [25, 20, 3, 4],
      [28, 23, 4, 4],
      [31, 26, 4, 4],
      [35, 28, 5, 4],
      [39, 28, 7, 2],
      [45, 29, 4, 2],
      [48, 30, 3, 2],
      [50, 31, 3, 2],
      [51, 33, 2, 2],
      [49, 34, 2, 2],
      [48, 35, 2, 2],
      [34, 34, 4, 3],
      [41, 37, 3, 2]
    ]);
    ctx.restore();
  }

  function drawEnemies() {
    for (var i = 0; i < enemies.length; i += 1) {
      var enemy = enemies[i];
      if (!enemy.alive) continue;
      if (enemy.kind === "spider") drawSpider(enemy);
      if (enemy.kind === "fancyBear") drawBear(enemy, false);
      if (enemy.kind === "cozyBear") drawBear(enemy, true);
    }
  }

  function drawSpider(enemy) {
    ctx.fillStyle = enemy.color;
    px(enemy.x, enemy.y, 2, 2, [
      [4, 2, 5, 5],
      [6, 0, 3, 2],
      [1, 1, 3, 1],
      [0, 4, 4, 1],
      [1, 7, 3, 1],
      [9, 1, 3, 1],
      [9, 4, 4, 1],
      [9, 7, 3, 1],
      [2, 9, 2, 1],
      [9, 9, 2, 1]
    ]);
    ctx.fillStyle = "#ff8bb0";
    px(enemy.x, enemy.y, 2, 2, [[5, 4, 1, 1], [8, 4, 1, 1]]);
    ctx.fillStyle = "rgba(204,51,102,0.45)";
    px(enemy.x - 4, enemy.y + 4, 2, 2, [[0, 0, 1, 1], [0, 3, 1, 1]]);
  }

  function drawBear(enemy, cozy) {
    ctx.fillStyle = enemy.color;
    var scale = cozy ? 2.2 : 2;
    px(enemy.x, enemy.y - (cozy ? 2 : 0), scale, scale, [
      [2, 1, 2, 2],
      [8, 1, 2, 2],
      [3, 2, 6, 2],
      [2, 4, 8, 5],
      [1, 6, 10, 4],
      [3, 10, 2, 2],
      [7, 10, 2, 2]
    ]);
    ctx.fillStyle = cozy ? "#ff2843" : "#c84351";
    px(enemy.x, enemy.y - (cozy ? 2 : 0), scale, scale, [[4, 5, 1, 1], [8, 5, 1, 1], [6, 7, 2, 1]]);
    ctx.fillStyle = "#1b0004";
    px(enemy.x, enemy.y - (cozy ? 2 : 0), scale, scale, [[5, 8, 3, 1]]);
  }

  function drawProjectiles() {
    for (var i = 0; i < playerShots.length; i += 1) {
      var playerShot = playerShots[i];
      ctx.fillStyle = RED;
      ctx.fillRect(Math.round(playerShot.x), Math.round(playerShot.y), playerShot.w, playerShot.h);
      ctx.fillStyle = WHITE;
      ctx.fillRect(Math.round(playerShot.x), Math.round(playerShot.y), 1, playerShot.h);
    }

    for (var e = 0; e < enemyShots.length; e += 1) {
      var shot = enemyShots[e];
      drawPixelText(shot.glyph, Math.round(shot.x), Math.round(shot.y), 1, GREEN);
    }
  }

  function drawBarriers() {
    for (var b = 0; b < barriers.length; b += 1) {
      var chunks = barriers[b].chunks;
      for (var c = 0; c < chunks.length; c += 1) {
        var chunk = chunks[c];
        ctx.fillStyle = chunk.hp > 1 ? "#0fa85f" : "#ecfff5";
        ctx.fillRect(chunk.x, chunk.y, chunk.w, chunk.h);
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(chunk.x + 2, chunk.y + 2, 2, 1);
      }
    }
  }

  function drawExplosions() {
    for (var i = 0; i < explosions.length; i += 1) {
      var ex = explosions[i];
      var p = 1 - ex.life / ex.maxLife;
      ctx.fillStyle = ex.color;
      ctx.fillRect(ex.x - 2 - p * 16, ex.y - 2, 4, 4);
      ctx.fillRect(ex.x + p * 14, ex.y - 2, 4, 4);
      ctx.fillRect(ex.x - 2, ex.y - 2 - p * 12, 4, 4);
      ctx.fillRect(ex.x - 2, ex.y + p * 12, 4, 4);
      ctx.fillStyle = WHITE;
      ctx.fillRect(ex.x - 1, ex.y - 1, 2, 2);
    }
  }

  function drawEndScreen(headline, subtitle, color) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.78)";
    ctx.fillRect(0, 0, W, H);
    drawCrowdStrikeLogo(W / 2 - 66, 48, 133, 82, 0.22);

    var glitch = state === "gameover" && Math.floor(tick * 12) % 3 === 0 ? 2 : 0;
    var scale = headline.length > 16 ? 2 : 3;
    var x = Math.round((W - headline.length * 6 * scale) / 2);
    drawPixelText(headline, x + glitch, 128, scale, color);
    drawPixelText(subtitle, Math.round((W - subtitle.length * 6 * 2) / 2), 172, 2, WHITE);
    drawPixelText("FINAL SCORE " + pad(score, 4), 168, 218, 1, "#bcbcbc");
    if (Math.floor(tick * 2) % 2 === 0) {
      drawPixelText("PRESS START", 174, 244, 1, GREEN);
    }
  }

  function drawWinScreen() {
    ctx.fillStyle = "rgba(0, 0, 0, 0.82)";
    ctx.fillRect(0, 0, W, H);
    drawCrowdStrikeLogo(W / 2 - 75, 40, 150, 92, 0.2);
    drawCenteredPixelText("GOOD GUYS WIN", 122, 2, GREEN);
    drawCenteredPixelText("MISSION ACCOMPLISHED. ONE TEAM, ONE VICTORY.", 154, 1, WHITE);
    drawCenteredPixelText("J.C. HERRERA", 192, 1, "#d6d6d6");
    drawCenteredPixelText("PLAY AGAIN?", 246, 1, GREEN);
  }

  function drawPixelText(text, x, y, scale, color) {
    text = String(text).toUpperCase();
    ctx.fillStyle = color;
    for (var i = 0; i < text.length; i += 1) {
      drawChar(text.charAt(i), x + i * 6 * scale, y, scale);
    }
  }

  function drawCenteredPixelText(text, y, scale, color) {
    drawPixelText(text, Math.round((W - getPixelTextWidth(text, scale)) / 2), y, scale, color);
  }

  function getPixelTextWidth(text, scale) {
    return String(text).length * 6 * scale;
  }

  var FONT = {
    "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    "B": ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
    "C": ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
    "D": ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
    "E": ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
    "F": ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
    "G": ["01111", "10000", "10000", "10011", "10001", "10001", "01110"],
    "H": ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
    "I": ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
    "J": ["00111", "00010", "00010", "00010", "10010", "10010", "01100"],
    "K": ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
    "L": ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    "M": ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
    "N": ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
    "O": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    "P": ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
    "Q": ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
    "R": ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    "S": ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
    "T": ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
    "U": ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
    "V": ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
    "W": ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
    "X": ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
    "Y": ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
    "Z": ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
    "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
    "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
    "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
    "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
    "4": ["10010", "10010", "10010", "11111", "00010", "00010", "00010"],
    "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
    "6": ["00111", "01000", "10000", "11110", "10001", "10001", "01110"],
    "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
    "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
    "9": ["01110", "10001", "10001", "01111", "00001", "00010", "11100"],
    " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
    ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
    ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
    "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"]
  };

  function drawChar(ch, x, y, scale) {
    var rows = FONT[ch] || FONT[" "];
    for (var row = 0; row < rows.length; row += 1) {
      for (var col = 0; col < rows[row].length; col += 1) {
        if (rows[row][col] === "1") {
          ctx.fillRect(x + col * scale, y + row * scale, scale, scale);
        }
      }
    }
  }

  function px(x, y, sx, sy, rects) {
    for (var i = 0; i < rects.length; i += 1) {
      var r = rects[i];
      ctx.fillRect(Math.round(x + r[0] * sx), Math.round(y + r[1] * sy), Math.ceil(r[2] * sx), Math.ceil(r[3] * sy));
    }
  }

  function pad(num, width) {
    var value = String(num);
    while (value.length < width) value = "0" + value;
    return value;
  }

  window.addEventListener("keydown", function (event) {
    keys[event.code] = true;
    if (["ArrowLeft", "ArrowRight", "Space", "Enter"].indexOf(event.code) !== -1) {
      event.preventDefault();
    }
    if (event.code === "Enter" || event.code === "Digit1" || event.code === "NumpadEnter") {
      advanceStart();
    }
  });

  window.addEventListener("keyup", function (event) {
    keys[event.code] = false;
  });

  canvas.addEventListener("pointerdown", function () {
    if (state === "title" || state === "briefing" || state === "win" || state === "gameover") {
      advanceStart();
    } else {
      keys.Space = true;
      setTimeout(function () {
        keys.Space = false;
      }, 120);
    }
  });

  function advanceStart() {
    initAudio();
    if (state === "title") {
      state = "briefing";
      playTone(520, 0.05, "square", 0.03);
      return;
    }
    if (state === "briefing") {
      startGame();
      return;
    }
    if (state === "win" || state === "gameover") {
      state = "briefing";
      playTone(520, 0.05, "square", 0.03);
    }
  }

  function loop(now) {
    var dt = Math.min(0.04, (now - lastTime) / 1000);
    lastTime = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  resetGame();
  requestAnimationFrame(loop);
}());

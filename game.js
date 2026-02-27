const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const world = {
  width: 4600,
  height: 4600,
  treeCount: 850,
};

const player = {
  x: world.width / 2,
  y: world.height / 2,
  radius: 12,
  speed: 235,
};

const dog = {
  x: player.x - 34,
  y: player.y + 18,
  radius: 10,
  speed: 190,
  wagTime: 0,
};

const camera = {
  x: player.x - canvas.width / 2,
  y: player.y - canvas.height / 2,
};

const keys = new Set();
const autumnPalette = ["#de6a2c", "#f39c12", "#c84727", "#f4be4f", "#9f3f2e"];

const trees = Array.from({ length: world.treeCount }, (_, i) => {
  const rand = seededRandom(i * 932 + 19);
  return {
    x: rand() * world.width,
    y: rand() * world.height,
    trunkWidth: 8 + rand() * 6,
    trunkHeight: 24 + rand() * 18,
    canopy: 26 + rand() * 24,
    color: autumnPalette[Math.floor(rand() * autumnPalette.length)],
  };
});

function seededRandom(seed) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

window.addEventListener("keydown", (event) => {
  keys.add(event.key.toLowerCase());
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

let last = performance.now();
requestAnimationFrame(loop);

function loop(timestamp) {
  const delta = (timestamp - last) / 1000;
  last = timestamp;

  updatePlayer(delta);
  updateDog(delta);
  updateCamera();
  render(timestamp / 1000);

  requestAnimationFrame(loop);
}

function updatePlayer(delta) {
  let moveX = 0;
  let moveY = 0;

  if (keys.has("arrowup") || keys.has("w")) moveY -= 1;
  if (keys.has("arrowdown") || keys.has("s")) moveY += 1;
  if (keys.has("arrowleft") || keys.has("a")) moveX -= 1;
  if (keys.has("arrowright") || keys.has("d")) moveX += 1;

  const length = Math.hypot(moveX, moveY);
  if (length > 0) {
    moveX /= length;
    moveY /= length;
  }

  player.x = clamp(player.x + moveX * player.speed * delta, 0, world.width);
  player.y = clamp(player.y + moveY * player.speed * delta, 0, world.height);
}

function updateDog(delta) {
  const dx = player.x - dog.x;
  const dy = player.y - dog.y;
  const dist = Math.hypot(dx, dy);
  const followDist = 44;

  if (dist > followDist) {
    dog.x += (dx / dist) * dog.speed * delta;
    dog.y += (dy / dist) * dog.speed * delta;
  }

  dog.wagTime += delta * (dist > 60 ? 14 : 6);
}

function updateCamera() {
  camera.x = clamp(player.x - canvas.width / 2, 0, world.width - canvas.width);
  camera.y = clamp(player.y - canvas.height / 2, 0, world.height - canvas.height);
}

function render(time) {
  drawGround(time);
  drawTrees();
  drawDog();
  drawPlayer();
  drawCompass();
}

function drawGround(time) {
  ctx.fillStyle = "#44563f";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const tile = 56;
  for (let sy = 0; sy < canvas.height + tile; sy += tile) {
    for (let sx = 0; sx < canvas.width + tile; sx += tile) {
      const wx = sx + camera.x;
      const wy = sy + camera.y;
      const noise = Math.sin(wx * 0.021) + Math.cos(wy * 0.015 + time * 0.35);
      const shade = Math.floor(60 + noise * 12);
      ctx.fillStyle = `rgb(${shade}, ${80 + noise * 8}, ${52 + noise * 6})`;
      ctx.fillRect(sx - (camera.x % tile), sy - (camera.y % tile), tile + 1, tile + 1);
    }
  }

  for (let i = 0; i < 130; i += 1) {
    const leafX = ((i * 137) % world.width) - camera.x;
    const leafY = ((i * 281) % world.height) - camera.y;
    if (leafX > -10 && leafX < canvas.width + 10 && leafY > -10 && leafY < canvas.height + 10) {
      const color = autumnPalette[i % autumnPalette.length];
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(leafX, leafY, 3, 2, (i + time) % Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawTrees() {
  for (const tree of trees) {
    const x = tree.x - camera.x;
    const y = tree.y - camera.y;
    if (x < -70 || y < -100 || x > canvas.width + 70 || y > canvas.height + 70) continue;

    ctx.fillStyle = "#5a3a24";
    ctx.fillRect(x - tree.trunkWidth / 2, y - tree.trunkHeight / 2, tree.trunkWidth, tree.trunkHeight);

    ctx.fillStyle = tree.color;
    ctx.beginPath();
    ctx.arc(x, y - tree.trunkHeight / 2, tree.canopy, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.arc(x - tree.canopy * 0.25, y - tree.trunkHeight / 2 - tree.canopy * 0.2, tree.canopy * 0.34, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlayer() {
  const x = player.x - camera.x;
  const y = player.y - camera.y;

  ctx.fillStyle = "#1f2d5c";
  ctx.beginPath();
  ctx.arc(x, y, player.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f1d2a8";
  ctx.beginPath();
  ctx.arc(x, y - 15, 8, 0, Math.PI * 2);
  ctx.fill();
}

function drawDog() {
  const x = dog.x - camera.x;
  const y = dog.y - camera.y;

  ctx.fillStyle = "#8f6a43";
  ctx.beginPath();
  ctx.ellipse(x, y, dog.radius + 4, dog.radius - 1, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#6d4e30";
  ctx.beginPath();
  ctx.arc(x + 10, y - 5, 6, 0, Math.PI * 2);
  ctx.fill();

  const wag = Math.sin(dog.wagTime) * 7;
  ctx.strokeStyle = "#6d4e30";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - 12, y + 1);
  ctx.quadraticCurveTo(x - 18 + wag, y - 6, x - 23 + wag, y + 4);
  ctx.stroke();

  ctx.fillStyle = "#111";
  ctx.beginPath();
  ctx.arc(x + 12, y - 6, 1.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawCompass() {
  const margin = 14;
  const size = 88;
  const x = canvas.width - size - margin;
  const y = margin;

  ctx.fillStyle = "rgba(9, 14, 11, 0.5)";
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = "rgba(255, 221, 178, 0.45)";
  ctx.strokeRect(x, y, size, size);

  const px = (player.x / world.width) * size;
  const py = (player.y / world.height) * size;

  ctx.fillStyle = "#f4be4f";
  ctx.beginPath();
  ctx.arc(x + px, y + py, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f7efd3";
  ctx.font = "12px sans-serif";
  ctx.fillText("N", x + size / 2 - 4, y + 12);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

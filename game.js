const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");
const dialogueEl = document.getElementById("dialogue");

const world = {
  width: 9200,
  height: 9200,
  treeCount: 1800,
};

const player = {
  x: world.width * 0.18,
  y: world.height * 0.2,
  radius: 12,
  speed: 250,
};

const camera = {
  x: 0,
  y: 0,
};

const keys = new Set();
const justPressed = new Set();
const discoveredBiomes = new Set();
const discoveredFalls = new Set();

const biomeNames = {
  autumnForest: "Autumn Forest",
  pineWoods: "Pine Woods",
  meadow: "Golden Meadow",
  mountain: "Misty Highlands",
  lakeside: "Lakeside Glade",
};

const palettes = {
  autumnForest: ["#de6a2c", "#f39c12", "#c84727", "#f4be4f", "#9f3f2e"],
  pineWoods: ["#2f6b3e", "#316f45", "#235c35"],
  meadow: ["#baa03b", "#c7ad44", "#d7c16d"],
  mountain: ["#65707a", "#56616a", "#747f88"],
  lakeside: ["#64b9c5", "#4fa8b6", "#7fc8d2"],
};

const towns = [
  {
    name: "Maple Hollow",
    x: 1650,
    y: 1780,
    radius: 340,
    home: { wall: 0, roof: 0, decor: 0 },
    npcIds: [0, 1],
  },
  {
    name: "Cedar Rest",
    x: 6750,
    y: 6720,
    radius: 370,
    home: { wall: 1, roof: 1, decor: 1 },
    npcIds: [2, 3],
  },
];

const npcs = [
  { x: 1530, y: 1670, name: "Ivy", town: 0, line: "Try the river trail at sunrise. The mist glows amber." },
  { x: 1760, y: 1900, name: "Milo", town: 0, line: "Build cozy first, grand later. Homes should feel warm." },
  { x: 6620, y: 6590, name: "Sage", town: 1, line: "Waterfalls in the north hide rare birds and calm moments." },
  { x: 6920, y: 6870, name: "Jun", town: 1, line: "Adopt companions at the lodge. Every trail feels better together." },
];

const adoptablePets = [
  { kind: "Dog", color: "#8f6a43", x: 1800, y: 1700 },
  { kind: "Fox", color: "#cd7a34", x: 1848, y: 1740 },
  { kind: "Cat", color: "#7d7d87", x: 1882, y: 1686 },
];

const companions = [
  { kind: "Dog", color: "#8f6a43", x: player.x - 34, y: player.y + 18, speed: 190, wagTime: 0 },
];
let activeCompanion = 0;

const wildlife = [];
for (let i = 0; i < 48; i += 1) {
  const rand = seededRandom(i * 119 + 31);
  wildlife.push({
    type: rand() > 0.5 ? "Deer" : "Rabbit",
    x: 700 + rand() * (world.width - 1400),
    y: 700 + rand() * (world.height - 1400),
    dir: rand() * Math.PI * 2,
    speed: 25 + rand() * 40,
    hue: rand() > 0.5 ? "#b79062" : "#d9d3c7",
  });
}

const rivers = [
  {
    name: "Amber Run",
    width: 48,
    path: (x) => world.height * 0.26 + Math.sin(x * 0.0015) * 320 + Math.sin(x * 0.005) * 70,
  },
  {
    name: "Moonbrook",
    width: 38,
    path: (x) => world.height * 0.64 + Math.cos(x * 0.0013 + 1.1) * 290,
  },
];

const waterfalls = [
  { x: 3150, y: rivers[0].path(3150), name: "Silver Drop" },
  { x: 7340, y: rivers[1].path(7340), name: "Whisper Falls" },
];

const trees = Array.from({ length: world.treeCount }, (_, i) => {
  const rand = seededRandom(i * 932 + 19);
  const x = rand() * world.width;
  const y = rand() * world.height;
  const biome = getBiome(x, y);
  const palette = palettes[biome] || palettes.autumnForest;
  return {
    x,
    y,
    trunkWidth: 8 + rand() * 6,
    trunkHeight: 22 + rand() * 20,
    canopy: 24 + rand() * 26,
    color: palette[Math.floor(rand() * palette.length)],
  };
});

let buildMode = false;
let messageTimer = 0;
let message = "Start your adventure with your loyal dog. Explore, adopt companions, and build a cozy home.";

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (!keys.has(key)) justPressed.add(key);
  keys.add(key);
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

let last = performance.now();
requestAnimationFrame(loop);

function loop(timestamp) {
  const delta = Math.min((timestamp - last) / 1000, 0.03);
  last = timestamp;

  updatePlayer(delta);
  updateCompanions(delta);
  updateWildlife(delta);
  handleInteractions();
  updateDiscoveries();
  updateCamera();
  render(timestamp / 1000);
  updateHud();

  justPressed.clear();
  if (messageTimer > 0) messageTimer -= delta;

  requestAnimationFrame(loop);
}

function handleInteractions() {
  if (justPressed.has("e")) {
    const nearNpc = nearestEntity(npcs, 76);
    if (nearNpc) {
      setMessage(`${nearNpc.name}: ${nearNpc.line}`);
      return;
    }

    const nearPet = nearestEntity(adoptablePets, 74);
    if (nearPet && !companions.some((c) => c.kind === nearPet.kind)) {
      companions.push({ kind: nearPet.kind, color: nearPet.color, x: player.x - 22, y: player.y + 20, speed: 175, wagTime: 0 });
      setMessage(`You adopted ${nearPet.kind}! Press P to switch active companion.`);
      return;
    }
  }

  if (justPressed.has("p") && companions.length > 1) {
    activeCompanion = (activeCompanion + 1) % companions.length;
    setMessage(`${companions[activeCompanion].kind} is now your active trail companion.`);
  }

  const town = nearestTown(210);
  if (justPressed.has("b") && town) {
    buildMode = !buildMode;
    setMessage(buildMode ? `Build mode enabled in ${town.name}. Press 1/2/3 to customize.` : "Build mode closed.");
  }

  if (buildMode && town) {
    if (justPressed.has("1")) town.home.wall = (town.home.wall + 1) % 3;
    if (justPressed.has("2")) town.home.roof = (town.home.roof + 1) % 3;
    if (justPressed.has("3")) town.home.decor = (town.home.decor + 1) % 3;
  }
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

function updateCompanions(delta) {
  companions.forEach((pet, idx) => {
    const offsetAngle = idx * 1.5;
    const targetX = player.x + Math.cos(offsetAngle) * (idx === activeCompanion ? -34 : -64);
    const targetY = player.y + Math.sin(offsetAngle) * (idx === activeCompanion ? 20 : 36);
    const dx = targetX - pet.x;
    const dy = targetY - pet.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 8) {
      pet.x += (dx / dist) * pet.speed * delta;
      pet.y += (dy / dist) * pet.speed * delta;
    }
    pet.wagTime += delta * (idx === activeCompanion ? 12 : 6);
  });
}

function updateWildlife(delta) {
  for (const animal of wildlife) {
    animal.dir += Math.sin((animal.x + animal.y) * 0.0004) * 0.03;
    animal.x = clamp(animal.x + Math.cos(animal.dir) * animal.speed * delta, 0, world.width);
    animal.y = clamp(animal.y + Math.sin(animal.dir) * animal.speed * delta, 0, world.height);
    if (Math.random() < 0.004) animal.dir += (Math.random() - 0.5) * 1.8;
  }
}

function updateDiscoveries() {
  const biome = getBiome(player.x, player.y);
  discoveredBiomes.add(biome);

  for (const falls of waterfalls) {
    const d = Math.hypot(player.x - falls.x, player.y - falls.y);
    if (d < 170) discoveredFalls.add(falls.name);
  }
}

function updateCamera() {
  camera.x = clamp(player.x - canvas.width / 2, 0, world.width - canvas.width);
  camera.y = clamp(player.y - canvas.height / 2, 0, world.height - canvas.height);
}

function render(time) {
  drawBiomeGround(time);
  drawRiversAndFalls(time);
  drawTrees();
  drawTowns();
  drawNpcs();
  drawWildlife();
  drawCompanions();
  drawPlayer();
  drawCompass();
}

function drawBiomeGround(time) {
  const tile = 64;
  for (let sy = 0; sy < canvas.height + tile; sy += tile) {
    for (let sx = 0; sx < canvas.width + tile; sx += tile) {
      const wx = sx + camera.x;
      const wy = sy + camera.y;
      const biome = getBiome(wx, wy);
      const base = biomeBaseColor(biome);
      const noise = Math.sin(wx * 0.014 + time * 0.15) + Math.cos(wy * 0.012);
      ctx.fillStyle = shadeColor(base, noise * 10);
      ctx.fillRect(sx - (camera.x % tile), sy - (camera.y % tile), tile + 1, tile + 1);
    }
  }
}

function drawRiversAndFalls(time) {
  for (const river of rivers) {
    ctx.beginPath();
    for (let x = camera.x - 80; x < camera.x + canvas.width + 80; x += 24) {
      const y = river.path(x);
      const sx = x - camera.x;
      const sy = y - camera.y;
      if (x === camera.x - 80) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.strokeStyle = "#4ca9d4";
    ctx.lineWidth = river.width;
    ctx.lineCap = "round";
    ctx.stroke();

    ctx.strokeStyle = `rgba(177, 225, 245, ${0.35 + Math.sin(time * 1.6) * 0.12})`;
    ctx.lineWidth = river.width * 0.24;
    ctx.stroke();
  }

  for (const falls of waterfalls) {
    const sx = falls.x - camera.x;
    const sy = falls.y - camera.y;
    if (sx < -90 || sx > canvas.width + 90 || sy < -90 || sy > canvas.height + 90) continue;

    ctx.fillStyle = "rgba(200,240,255,0.85)";
    ctx.fillRect(sx - 22, sy - 52, 44, 64);
    ctx.fillStyle = `rgba(176,230,255,${0.2 + Math.sin(time * 3) * 0.08})`;
    ctx.beginPath();
    ctx.ellipse(sx, sy + 16, 42, 16, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTrees() {
  for (const tree of trees) {
    const x = tree.x - camera.x;
    const y = tree.y - camera.y;
    if (x < -80 || y < -110 || x > canvas.width + 80 || y > canvas.height + 80) continue;

    ctx.fillStyle = "#5a3a24";
    ctx.fillRect(x - tree.trunkWidth / 2, y - tree.trunkHeight / 2, tree.trunkWidth, tree.trunkHeight);

    ctx.fillStyle = tree.color;
    ctx.beginPath();
    ctx.arc(x, y - tree.trunkHeight / 2, tree.canopy, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTowns() {
  for (const town of towns) {
    const sx = town.x - camera.x;
    const sy = town.y - camera.y;
    if (sx < -500 || sy < -500 || sx > canvas.width + 500 || sy > canvas.height + 500) continue;

    ctx.strokeStyle = "rgba(252, 218, 146, 0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, sy, town.radius, 0, Math.PI * 2);
    ctx.stroke();

    drawHouse(town, sx + 36, sy + 22);

    ctx.fillStyle = "#f6e9c2";
    ctx.font = "14px sans-serif";
    ctx.fillText(town.name, sx - 44, sy - town.radius - 8);
  }

  for (const pet of adoptablePets) {
    const sx = pet.x - camera.x;
    const sy = pet.y - camera.y;
    if (sx < -40 || sy < -40 || sx > canvas.width + 40 || sy > canvas.height + 40) continue;
    ctx.fillStyle = pet.color;
    ctx.beginPath();
    ctx.arc(sx, sy, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.fillText(pet.kind, sx + 9, sy + 4);
  }
}

function drawHouse(town, x, y) {
  const wallColors = ["#c58f6d", "#8ca0b5", "#d8c89d"];
  const roofColors = ["#894938", "#586274", "#6f8a4f"];
  const decorColors = ["#f4b35f", "#9ed5b5", "#f7e39a"];

  ctx.fillStyle = wallColors[town.home.wall];
  ctx.fillRect(x - 28, y - 18, 56, 34);

  ctx.fillStyle = roofColors[town.home.roof];
  ctx.beginPath();
  ctx.moveTo(x - 36, y - 18);
  ctx.lineTo(x, y - 44);
  ctx.lineTo(x + 36, y - 18);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = decorColors[town.home.decor];
  ctx.beginPath();
  ctx.arc(x - 15, y + 7, 6, 0, Math.PI * 2);
  ctx.arc(x + 15, y + 7, 6, 0, Math.PI * 2);
  ctx.fill();
}

function drawNpcs() {
  for (const npc of npcs) {
    const sx = npc.x - camera.x;
    const sy = npc.y - camera.y;
    if (sx < -30 || sy < -40 || sx > canvas.width + 30 || sy > canvas.height + 30) continue;

    ctx.fillStyle = "#394f8c";
    ctx.beginPath();
    ctx.arc(sx, sy, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f2d3aa";
    ctx.beginPath();
    ctx.arc(sx, sy - 13, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f8edca";
    ctx.font = "12px sans-serif";
    ctx.fillText(npc.name, sx - 14, sy - 22);
  }
}

function drawWildlife() {
  for (const animal of wildlife) {
    const sx = animal.x - camera.x;
    const sy = animal.y - camera.y;
    if (sx < -35 || sy < -35 || sx > canvas.width + 35 || sy > canvas.height + 35) continue;

    ctx.fillStyle = animal.hue;
    ctx.beginPath();
    ctx.ellipse(sx, sy, animal.type === "Deer" ? 10 : 7, animal.type === "Deer" ? 6 : 5, animal.dir, 0, Math.PI * 2);
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

function drawCompanions() {
  companions.forEach((pet, idx) => {
    const x = pet.x - camera.x;
    const y = pet.y - camera.y;
    const isActive = idx === activeCompanion;

    ctx.fillStyle = pet.color;
    ctx.beginPath();
    ctx.ellipse(x, y, isActive ? 13 : 11, isActive ? 9 : 8, 0, 0, Math.PI * 2);
    ctx.fill();

    const wag = Math.sin(pet.wagTime) * (isActive ? 8 : 5);
    ctx.strokeStyle = shadeColor(pet.color, -22);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 10, y + 1);
    ctx.quadraticCurveTo(x - 16 + wag, y - 4, x - 22 + wag, y + 4);
    ctx.stroke();
  });
}

function drawCompass() {
  const margin = 14;
  const size = 116;
  const x = canvas.width - size - margin;
  const y = margin;

  ctx.fillStyle = "rgba(9, 14, 11, 0.54)";
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

function updateHud() {
  const biome = biomeNames[getBiome(player.x, player.y)];
  const town = nearestTown(190);
  const active = companions[activeCompanion];

  statusEl.textContent = [
    `Biome: ${biome}`,
    `Companion: ${active.kind} (${activeCompanion + 1}/${companions.length})`,
    `Discovered Biomes: ${discoveredBiomes.size}/${Object.keys(biomeNames).length}`,
    `Waterfalls Found: ${discoveredFalls.size}/${waterfalls.length}`,
    town ? `Town: ${town.name} ${buildMode ? "(Build Mode)" : ""}` : "Town: wilderness",
  ].join("  •  ");

  dialogueEl.textContent = messageTimer > 0 ? message : "Explore the wilds, chat with townsfolk, adopt companions, and craft your cozy home.";
}

function nearestTown(maxDist) {
  let best = null;
  let bestDist = maxDist;
  for (const town of towns) {
    const d = Math.hypot(player.x - town.x, player.y - town.y);
    if (d < bestDist) {
      bestDist = d;
      best = town;
    }
  }
  return best;
}

function nearestEntity(list, maxDist) {
  let best = null;
  let bestDist = maxDist;
  for (const item of list) {
    const d = Math.hypot(player.x - item.x, player.y - item.y);
    if (d < bestDist) {
      bestDist = d;
      best = item;
    }
  }
  return best;
}

function getBiome(x, y) {
  const noise = Math.sin(x * 0.0009) + Math.cos(y * 0.0008) + Math.sin((x + y) * 0.00035);
  const riverDist = distanceToRiver(x, y);

  if (riverDist < 62) return "lakeside";
  if (noise > 1.3) return "mountain";
  if (noise > 0.35) return "autumnForest";
  if (noise > -0.45) return "pineWoods";
  return "meadow";
}

function distanceToRiver(x, y) {
  let best = Number.POSITIVE_INFINITY;
  for (const river of rivers) {
    const ry = river.path(x);
    best = Math.min(best, Math.abs(ry - y));
  }
  return best;
}

function biomeBaseColor(biome) {
  switch (biome) {
    case "mountain":
      return "#56626b";
    case "pineWoods":
      return "#38543e";
    case "meadow":
      return "#8f8240";
    case "lakeside":
      return "#3f7d86";
    default:
      return "#5b653f";
  }
}

function setMessage(text) {
  message = text;
  messageTimer = 6;
}

function shadeColor(hex, amount) {
  const clean = hex.replace("#", "");
  const n = Number.parseInt(clean, 16);
  const r = clamp(((n >> 16) & 255) + amount, 0, 255);
  const g = clamp(((n >> 8) & 255) + amount, 0, 255);
  const b = clamp((n & 255) + amount, 0, 255);
  return `rgb(${r}, ${g}, ${b})`;
}

function seededRandom(seed) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

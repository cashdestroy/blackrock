const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");
const dialogueEl = document.getElementById("dialogue");

const world = { width: 14000, depth: 14000 };
const FOV = Math.PI / 2.8;

const player = {
  x: 2200,
  z: 2200,
  y: 0,
  angle: 0.5,
  speed: 220,
  turnSpeed: 2.1,
  eyeHeight: 42,
};

const keys = new Set();
const justPressed = new Set();
let message = "Welcome to Cozy Wilds 3D. Explore, build, and adventure with your dog.";
let messageTimer = 0;

const discoveredBiomes = new Set();
const discoveredFalls = new Set();

const biomeNames = {
  autumn: "Autumn Forest",
  pine: "Pine Woods",
  meadow: "Sunset Meadow",
  mountain: "Misty Highlands",
  lakeside: "Lakeside",
};

const towns = [
  { name: "Maple Hollow", x: 2500, z: 2350, radius: 600, home: { wall: 0, roof: 0, decor: 0 } },
  { name: "Cedar Rest", x: 10000, z: 9900, radius: 680, home: { wall: 1, roof: 1, decor: 2 } },
];

const npcs = [
  { name: "Ivy", x: 2640, z: 2500, line: "If you follow the river west you'll find hidden falls." },
  { name: "Milo", x: 2240, z: 2200, line: "A cozy home starts small. Press B, then 1/2/3." },
  { name: "Sage", x: 9930, z: 10120, line: "The highlands feel like old RPG adventures at dusk." },
  { name: "Jun", x: 10180, z: 9800, line: "Adopt foxes and cats near town lodges with E." },
];

const adoptablePets = [
  { kind: "Fox", color: "#d67931", x: 2430, z: 2580 },
  { kind: "Cat", color: "#8f8f9d", x: 2580, z: 2620 },
];

const companions = [{ kind: "Dog", color: "#8f6a43", x: player.x - 60, z: player.z + 50, speed: 180, wag: 0 }];
let activeCompanion = 0;
let buildMode = false;

const wildlife = Array.from({ length: 80 }, (_, i) => {
  const rand = seededRandom(i * 912 + 41);
  return {
    type: rand() > 0.5 ? "Deer" : "Rabbit",
    x: 900 + rand() * (world.width - 1800),
    z: 900 + rand() * (world.depth - 1800),
    dir: rand() * Math.PI * 2,
    speed: 26 + rand() * 36,
    color: rand() > 0.5 ? "#b69061" : "#dbd5c9",
  };
});

const trees = Array.from({ length: 2200 }, (_, i) => {
  const rand = seededRandom(i * 193 + 17);
  const x = rand() * world.width;
  const z = rand() * world.depth;
  const biome = getBiome(x, z);
  return {
    x,
    z,
    h: 65 + rand() * 55,
    w: 28 + rand() * 16,
    color: biomeLeafColor(biome, rand()),
  };
});

const rivers = [
  { name: "Amber Run", width: 120, path: (x) => world.depth * 0.3 + Math.sin(x * 0.0012) * 430 + Math.sin(x * 0.0048) * 90 },
  { name: "Moonbrook", width: 90, path: (x) => world.depth * 0.72 + Math.cos(x * 0.0011 + 0.6) * 340 },
];

const waterfalls = [
  { name: "Silver Drop", x: 4900, z: rivers[0].path(4900) },
  { name: "Whisper Falls", x: 10900, z: rivers[1].path(10900) },
];

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (!keys.has(key)) justPressed.add(key);
  keys.add(key);
});
window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));

let last = performance.now();
requestAnimationFrame(loop);

function loop(t) {
  const dt = Math.min((t - last) / 1000, 0.033);
  last = t;

  updatePlayer(dt);
  updateCompanions(dt);
  updateWildlife(dt);
  handleInteractions();
  updateDiscoveries();
  render(t / 1000);
  updateHud();

  justPressed.clear();
  if (messageTimer > 0) messageTimer -= dt;
  requestAnimationFrame(loop);
}

function updatePlayer(dt) {
  if (keys.has("arrowleft") || keys.has("q")) player.angle -= player.turnSpeed * dt;
  if (keys.has("arrowright") || keys.has("e")) player.angle += player.turnSpeed * dt;

  let move = 0;
  if (keys.has("w") || keys.has("arrowup")) move += 1;
  if (keys.has("s") || keys.has("arrowdown")) move -= 1;

  const strafe = (keys.has("a") ? -1 : 0) + (keys.has("d") ? 1 : 0);
  const runMul = keys.has("shift") ? 1.4 : 1;

  const forwardX = Math.cos(player.angle);
  const forwardZ = Math.sin(player.angle);
  const rightX = Math.cos(player.angle + Math.PI / 2);
  const rightZ = Math.sin(player.angle + Math.PI / 2);

  player.x = clamp(player.x + (forwardX * move + rightX * strafe) * player.speed * runMul * dt, 20, world.width - 20);
  player.z = clamp(player.z + (forwardZ * move + rightZ * strafe) * player.speed * runMul * dt, 20, world.depth - 20);

  const ground = terrainHeight(player.x, player.z);
  player.y += (ground + player.eyeHeight - player.y) * Math.min(1, dt * 8);
}

function updateCompanions(dt) {
  companions.forEach((pet, idx) => {
    const ring = idx === activeCompanion ? 70 : 110;
    const offset = player.angle + Math.PI + idx * 0.95;
    const tx = player.x + Math.cos(offset) * ring;
    const tz = player.z + Math.sin(offset) * ring;
    const dx = tx - pet.x;
    const dz = tz - pet.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 4) {
      pet.x += (dx / dist) * pet.speed * dt;
      pet.z += (dz / dist) * pet.speed * dt;
    }
    pet.wag += dt * (idx === activeCompanion ? 11 : 6);
  });
}

function updateWildlife(dt) {
  for (const animal of wildlife) {
    animal.dir += Math.sin((animal.x + animal.z) * 0.00045) * 0.032;
    animal.x = clamp(animal.x + Math.cos(animal.dir) * animal.speed * dt, 30, world.width - 30);
    animal.z = clamp(animal.z + Math.sin(animal.dir) * animal.speed * dt, 30, world.depth - 30);
    if (Math.random() < 0.006) animal.dir += (Math.random() - 0.5) * 1.6;
  }
}

function handleInteractions() {
  if (justPressed.has("f")) {
    const npc = nearestEntity(npcs, 190);
    if (npc) {
      setMessage(`${npc.name}: ${npc.line}`);
      return;
    }

    const pet = nearestEntity(adoptablePets, 160);
    if (pet && !companions.some((c) => c.kind === pet.kind)) {
      companions.push({ kind: pet.kind, color: pet.color, x: player.x - 40, z: player.z + 40, speed: 172, wag: 0 });
      setMessage(`You adopted a ${pet.kind}! Press P to switch companion.`);
      return;
    }
  }

  if (justPressed.has("p") && companions.length > 1) {
    activeCompanion = (activeCompanion + 1) % companions.length;
    setMessage(`${companions[activeCompanion].kind} is now your active companion.`);
  }

  const town = nearestTown(360);
  if (justPressed.has("b") && town) {
    buildMode = !buildMode;
    setMessage(buildMode ? `Build mode enabled in ${town.name}. Use 1/2/3 to customize.` : "Build mode disabled.");
  }

  if (buildMode && town) {
    if (justPressed.has("1")) town.home.wall = (town.home.wall + 1) % 3;
    if (justPressed.has("2")) town.home.roof = (town.home.roof + 1) % 3;
    if (justPressed.has("3")) town.home.decor = (town.home.decor + 1) % 3;
  }
}

function updateDiscoveries() {
  discoveredBiomes.add(getBiome(player.x, player.z));
  for (const falls of waterfalls) {
    if (Math.hypot(player.x - falls.x, player.z - falls.z) < 240) discoveredFalls.add(falls.name);
  }
}

function render(time) {
  const w = canvas.width;
  const h = canvas.height;
  const horizon = h * 0.41;
  const camScale = 650;

  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, "#8aa2be");
  sky.addColorStop(1, "#e2b07b");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizon);

  drawFarMountains(horizon);

  const stepX = 2;
  const stepY = 2;
  for (let sy = Math.floor(horizon); sy < h; sy += stepY) {
    const dist = (player.y * camScale) / Math.max(1, sy - horizon);
    for (let sx = 0; sx < w; sx += stepX) {
      const ray = player.angle + ((sx / w) - 0.5) * FOV;
      const wx = player.x + Math.cos(ray) * dist;
      const wz = player.z + Math.sin(ray) * dist;

      const biome = getBiome(wx, wz);
      let col = terrainColor(biome, wx, wz, time);

      const fog = clamp(dist / 2600, 0, 0.75);
      col = mixColor(col, "#9ba5af", fog);

      ctx.fillStyle = col;
      ctx.fillRect(sx, sy, stepX + 1, stepY + 1);
    }
  }

  drawSceneObjects(horizon, camScale, time);
}

function drawFarMountains(horizon) {
  ctx.fillStyle = "#59626f";
  ctx.beginPath();
  ctx.moveTo(0, horizon + 48);
  for (let x = 0; x <= canvas.width; x += 12) {
    const nx = x / canvas.width;
    const y = horizon + 20 + Math.sin(nx * 11) * 26 + Math.cos(nx * 20) * 14;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(canvas.width, horizon + 80);
  ctx.lineTo(0, horizon + 80);
  ctx.closePath();
  ctx.fill();
}

function drawSceneObjects(horizon, camScale, time) {
  const objects = [];

  const closeTrees = nearestChunk(trees, 1800);
  for (const tree of closeTrees) {
    objects.push({ type: "tree", x: tree.x, z: tree.z, h: tree.h, w: tree.w, color: tree.color });
  }

  for (const town of towns) {
    objects.push({ type: "town", x: town.x, z: town.z, town });
  }

  for (const npc of npcs) objects.push({ type: "npc", x: npc.x, z: npc.z, npc });
  for (const pet of adoptablePets) objects.push({ type: "adopt", x: pet.x, z: pet.z, pet });
  for (const animal of wildlife) objects.push({ type: "animal", x: animal.x, z: animal.z, animal });
  companions.forEach((pet, idx) => objects.push({ type: "companion", x: pet.x, z: pet.z, pet, idx }));
  waterfalls.forEach((falls) => objects.push({ type: "falls", x: falls.x, z: falls.z, falls }));

  const visible = [];
  for (const obj of objects) {
    const p = project(obj.x, obj.z, horizon, camScale);
    if (!p || p.depth > 3000) continue;
    visible.push({ ...obj, ...p });
  }

  visible.sort((a, b) => b.depth - a.depth);

  for (const obj of visible) {
    switch (obj.type) {
      case "tree":
        drawTreeSprite(obj);
        break;
      case "town":
        drawTownSprite(obj);
        break;
      case "npc":
        drawPerson(obj, "#39558f", 56);
        break;
      case "adopt":
        drawPetSprite(obj.screenX, obj.groundY, obj.scale, obj.pet.color, false);
        drawLabel(obj.pet.kind, obj.screenX + 8, obj.groundY - 24);
        break;
      case "animal":
        drawAnimal(obj);
        break;
      case "companion":
        drawPetSprite(obj.screenX, obj.groundY, obj.scale, obj.pet.color, obj.idx === activeCompanion, obj.pet.wag + time * 4);
        break;
      case "falls":
        drawWaterfall(obj, time);
        break;
      default:
        break;
    }
  }

  drawPlayerHands();
}

function drawTreeSprite(obj) {
  const trunkW = obj.scale * 8;
  const trunkH = obj.scale * 24;
  const crownR = obj.scale * 22;
  ctx.fillStyle = "#614027";
  ctx.fillRect(obj.screenX - trunkW / 2, obj.groundY - trunkH, trunkW, trunkH);

  ctx.fillStyle = obj.color;
  ctx.beginPath();
  ctx.arc(obj.screenX, obj.groundY - trunkH - crownR * 0.8, crownR, 0, Math.PI * 2);
  ctx.fill();
}

function drawTownSprite(obj) {
  const { town } = obj;
  const wallColors = ["#c58f6d", "#8ca0b5", "#d8c89d"];
  const roofColors = ["#894938", "#586274", "#6f8a4f"];
  const decorColors = ["#f4b35f", "#9ed5b5", "#f7e39a"];

  const w = obj.scale * 44;
  const h = obj.scale * 28;
  ctx.fillStyle = wallColors[town.home.wall];
  ctx.fillRect(obj.screenX - w / 2, obj.groundY - h, w, h);

  ctx.fillStyle = roofColors[town.home.roof];
  ctx.beginPath();
  ctx.moveTo(obj.screenX - w * 0.62, obj.groundY - h);
  ctx.lineTo(obj.screenX, obj.groundY - h - obj.scale * 20);
  ctx.lineTo(obj.screenX + w * 0.62, obj.groundY - h);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = decorColors[town.home.decor];
  ctx.fillRect(obj.screenX - obj.scale * 8, obj.groundY - obj.scale * 11, obj.scale * 16, obj.scale * 8);
  drawLabel(town.name, obj.screenX - w * 0.5, obj.groundY - h - obj.scale * 16);
}

function drawPerson(obj, bodyColor, h) {
  const r = obj.scale * 6;
  ctx.fillStyle = bodyColor;
  ctx.fillRect(obj.screenX - r, obj.groundY - obj.scale * h, r * 2, obj.scale * (h - 12));
  ctx.fillStyle = "#f2d4ae";
  ctx.beginPath();
  ctx.arc(obj.screenX, obj.groundY - obj.scale * h, obj.scale * 6, 0, Math.PI * 2);
  ctx.fill();
  drawLabel(obj.npc.name, obj.screenX - obj.scale * 14, obj.groundY - obj.scale * (h + 14));
}

function drawPetSprite(x, y, scale, color, active, wagT = 0) {
  const bodyW = scale * (active ? 24 : 19);
  const bodyH = scale * (active ? 15 : 12);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y - bodyH * 0.6, bodyW * 0.5, bodyH * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = shadeColor(color, -24);
  ctx.lineWidth = Math.max(1, scale * 3);
  ctx.beginPath();
  ctx.moveTo(x - bodyW * 0.45, y - bodyH * 0.7);
  ctx.quadraticCurveTo(x - bodyW * 0.62 + Math.sin(wagT) * scale * 8, y - bodyH, x - bodyW * 0.8, y - bodyH * 0.65);
  ctx.stroke();
}

function drawAnimal(obj) {
  const w = obj.scale * (obj.animal.type === "Deer" ? 20 : 14);
  const h = obj.scale * (obj.animal.type === "Deer" ? 13 : 9);
  ctx.fillStyle = obj.animal.color;
  ctx.beginPath();
  ctx.ellipse(obj.screenX, obj.groundY - h * 0.6, w * 0.5, h * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawWaterfall(obj, time) {
  const h = obj.scale * 56;
  const w = obj.scale * 22;
  ctx.fillStyle = "rgba(198,237,255,0.85)";
  ctx.fillRect(obj.screenX - w * 0.5, obj.groundY - h, w, h);
  ctx.fillStyle = `rgba(153,218,255,${0.26 + Math.sin(time * 4) * 0.09})`;
  ctx.beginPath();
  ctx.ellipse(obj.screenX, obj.groundY - 2, w * 1.35, obj.scale * 7, 0, 0, Math.PI * 2);
  ctx.fill();
  drawLabel(obj.falls.name, obj.screenX - w * 1.2, obj.groundY - h - obj.scale * 10);
}

function drawLabel(text, x, y) {
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(x - 3, y - 11, text.length * 7.2, 14);
  ctx.fillStyle = "#ffeec5";
  ctx.font = "12px sans-serif";
  ctx.fillText(text, x, y);
}

function drawPlayerHands() {
  const y = canvas.height - 38;
  ctx.fillStyle = "#2b3555";
  ctx.fillRect(canvas.width * 0.25 - 70, y, 130, 44);
  ctx.fillRect(canvas.width * 0.75 - 60, y, 120, 44);
}

function updateHud() {
  const town = nearestTown(360);
  const biome = biomeNames[getBiome(player.x, player.z)];
  statusEl.textContent = [
    `Mode: 3D Retro Adventure`,
    `Biome: ${biome}`,
    `Companion: ${companions[activeCompanion].kind} (${activeCompanion + 1}/${companions.length})`,
    `Discovered: ${discoveredBiomes.size}/${Object.keys(biomeNames).length} biomes`,
    `Waterfalls: ${discoveredFalls.size}/${waterfalls.length}`,
    town ? `Town: ${town.name} ${buildMode ? "(Build Mode)" : ""}` : "Town: wilderness",
  ].join("  •  ");

  dialogueEl.textContent = messageTimer > 0
    ? message
    : "WASD move, Arrow Left/Right turn, F interact, B build in town, P swap pet. Explore like a cozy PS2-era world.";
}

function project(x, z, horizon, camScale) {
  const dx = x - player.x;
  const dz = z - player.z;
  const sin = Math.sin(player.angle);
  const cos = Math.cos(player.angle);
  const depth = dx * cos + dz * sin;
  const side = -dx * sin + dz * cos;
  if (depth <= 3) return null;

  const screenX = canvas.width / 2 + (side / depth) * camScale;
  const ground = terrainHeight(x, z);
  const groundY = horizon + ((player.y - ground) / depth) * camScale;
  const scale = camScale / depth;
  return { depth, screenX, groundY, scale };
}

function nearestEntity(list, maxDist) {
  let best = null;
  let dist = maxDist;
  for (const item of list) {
    const d = Math.hypot(player.x - item.x, player.z - item.z);
    if (d < dist) {
      dist = d;
      best = item;
    }
  }
  return best;
}

function nearestTown(maxDist) {
  return nearestEntity(towns, maxDist);
}

function nearestChunk(list, maxDist) {
  const out = [];
  for (const item of list) {
    if (Math.abs(item.x - player.x) < maxDist && Math.abs(item.z - player.z) < maxDist) out.push(item);
  }
  return out;
}

function getBiome(x, z) {
  const riverD = distanceToRiver(x, z);
  const noise = Math.sin(x * 0.0008) + Math.cos(z * 0.00095) + Math.sin((x + z) * 0.00024);
  if (riverD < 78) return "lakeside";
  if (noise > 1.35) return "mountain";
  if (noise > 0.3) return "autumn";
  if (noise > -0.5) return "pine";
  return "meadow";
}

function terrainHeight(x, z) {
  const undulate = Math.sin(x * 0.0021) * 22 + Math.cos(z * 0.0018) * 20 + Math.sin((x + z) * 0.0009) * 16;
  const mnt = Math.max(0, Math.sin(x * 0.0007 + 0.7) + Math.cos(z * 0.00065) - 1.05) * 120;
  const river = Math.max(0, 70 - distanceToRiver(x, z)) * 0.55;
  return undulate + mnt - river;
}

function distanceToRiver(x, z) {
  let best = Number.POSITIVE_INFINITY;
  for (const river of rivers) {
    const rz = river.path(x);
    best = Math.min(best, Math.abs(rz - z));
  }
  return best;
}

function terrainColor(biome, x, z, time) {
  const flicker = (Math.sin(x * 0.01 + time * 0.4) + Math.cos(z * 0.01)) * 4;
  if (distanceToRiver(x, z) < 68) return shadeColor("#4f9fca", flicker);
  switch (biome) {
    case "mountain":
      return shadeColor("#66707b", flicker);
    case "pine":
      return shadeColor("#34533f", flicker);
    case "meadow":
      return shadeColor("#8b8241", flicker);
    case "lakeside":
      return shadeColor("#4e8f98", flicker);
    default:
      return shadeColor("#5d643e", flicker);
  }
}

function biomeLeafColor(biome, n) {
  if (biome === "pine") return n > 0.5 ? "#356642" : "#2f5c3c";
  if (biome === "meadow") return n > 0.5 ? "#aa9c43" : "#bcab58";
  if (biome === "mountain") return n > 0.5 ? "#6c757d" : "#7a838d";
  if (biome === "lakeside") return n > 0.5 ? "#5aa5b1" : "#6fb3be";
  const autumn = ["#de6a2c", "#f39c12", "#c84727", "#f4be4f", "#9f3f2e"];
  return autumn[Math.floor(n * autumn.length) % autumn.length];
}

function setMessage(text) {
  message = text;
  messageTimer = 6;
}

function mixColor(c1, c2, t) {
  const a = hexToRgb(c1);
  const b = hexToRgb(c2);
  return `rgb(${Math.round(a.r + (b.r - a.r) * t)}, ${Math.round(a.g + (b.g - a.g) * t)}, ${Math.round(a.b + (b.b - a.b) * t)})`;
}

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const n = Number.parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function shadeColor(hex, amount) {
  const rgb = hexToRgb(hex);
  return `rgb(${clamp(rgb.r + amount, 0, 255)}, ${clamp(rgb.g + amount, 0, 255)}, ${clamp(rgb.b + amount, 0, 255)})`;
}

function seededRandom(seed) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");
const dialogueEl = document.getElementById("dialogue");

const world = { width: 18000, depth: 18000 };
const FOV = Math.PI / 2.75;

const player = {
  x: 2400,
  z: 2400,
  y: 0,
  angle: 0.42,
  speed: 250,
  turnSpeed: 2.2,
  eyeHeight: 48,
  walkTime: 0,
};

const sun = { x: 0.55, y: 0.78, z: 0.35 };
const keys = new Set();
const justPressed = new Set();
let message = "Enhanced build loaded. Explore a denser, more realistic world.";
let messageTimer = 0;
let buildMode = false;
let activeCompanion = 0;

const discoveredBiomes = new Set();
const discoveredFalls = new Set();
const biomeNames = {
  autumn: "Autumn Forest",
  pine: "Pine Woods",
  meadow: "Sunlit Meadow",
  mountain: "Highlands",
  lakeside: "Lakeside",
};

const towns = [
  { name: "Maple Hollow", x: 2600, z: 2500, radius: 760, home: { wall: 0, roof: 0, decor: 0 } },
  { name: "Cedar Rest", x: 12600, z: 11800, radius: 820, home: { wall: 1, roof: 1, decor: 2 } },
];

const npcs = [
  { name: "Ivy", x: 2790, z: 2430, line: "This valley gets photoreal at sunrise. Follow the river bend." },
  { name: "Milo", x: 2440, z: 2740, line: "Cozy starts simple: press B, then 1/2/3 for your home style." },
  { name: "Sage", x: 12480, z: 11980, line: "The mountain fog now settles naturally over the trees." },
  { name: "Jun", x: 12740, z: 11620, line: "Adopt a fox or cat near this lodge with F." },
];

const adoptablePets = [
  { kind: "Fox", color: "#cd7330", x: 2670, z: 2850 },
  { kind: "Cat", color: "#8f92a4", x: 2860, z: 2700 },
  { kind: "Wolf Pup", color: "#8f8b80", x: 12420, z: 12090 },
];

const companions = [{ kind: "Dog", color: "#8f6a43", x: player.x - 64, z: player.z + 56, speed: 190, wag: 0 }];

const rivers = [
  { name: "Amber Run", width: 130, path: (x) => world.depth * 0.29 + Math.sin(x * 0.0012) * 470 + Math.sin(x * 0.0052) * 105 },
  { name: "Moonbrook", width: 98, path: (x) => world.depth * 0.74 + Math.cos(x * 0.00115 + 0.65) * 370 },
];

const waterfalls = [
  { name: "Silver Drop", x: 5200, z: rivers[0].path(5200) },
  { name: "Whisper Falls", x: 13200, z: rivers[1].path(13200) },
];

const wildlife = Array.from({ length: 140 }, (_, i) => {
  const rand = seededRandom(i * 901 + 41);
  return {
    type: rand() > 0.55 ? "Deer" : "Rabbit",
    x: 700 + rand() * (world.width - 1400),
    z: 700 + rand() * (world.depth - 1400),
    dir: rand() * Math.PI * 2,
    speed: 24 + rand() * 44,
    color: rand() > 0.5 ? "#b69061" : "#d7d2c8",
  };
});

const trees = Array.from({ length: 4200 }, (_, i) => {
  const rand = seededRandom(i * 193 + 17);
  const x = rand() * world.width;
  const z = rand() * world.depth;
  const biome = getBiome(x, z);
  return {
    x,
    z,
    h: 68 + rand() * 82,
    w: 28 + rand() * 20,
    trunk: 9 + rand() * 5,
    color: biomeLeafColor(biome, rand()),
  };
});

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (!keys.has(key)) justPressed.add(key);
  keys.add(key);
});
window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));

let last = performance.now();
requestAnimationFrame(loop);

function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.033);
  last = now;

  updatePlayer(dt);
  updateCompanions(dt);
  updateWildlife(dt);
  handleInteractions();
  updateDiscoveries();
  render(now / 1000);
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
  const runMul = keys.has("shift") ? 1.45 : 1;

  const fX = Math.cos(player.angle);
  const fZ = Math.sin(player.angle);
  const rX = Math.cos(player.angle + Math.PI / 2);
  const rZ = Math.sin(player.angle + Math.PI / 2);

  player.x = clamp(player.x + (fX * move + rX * strafe) * player.speed * runMul * dt, 20, world.width - 20);
  player.z = clamp(player.z + (fZ * move + rZ * strafe) * player.speed * runMul * dt, 20, world.depth - 20);

  player.walkTime += Math.hypot(move, strafe) > 0 ? dt * 10 * runMul : dt * 2;
  const bob = Math.sin(player.walkTime) * (keys.has("shift") ? 1.8 : 1.1);
  const ground = terrainHeight(player.x, player.z);
  player.y += (ground + player.eyeHeight + bob - player.y) * Math.min(1, dt * 9);
}

function updateCompanions(dt) {
  companions.forEach((pet, idx) => {
    const ring = idx === activeCompanion ? 85 : 120 + idx * 10;
    const offset = player.angle + Math.PI + idx * 0.85;
    const tx = player.x + Math.cos(offset) * ring;
    const tz = player.z + Math.sin(offset) * ring;
    const dx = tx - pet.x;
    const dz = tz - pet.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 4) {
      pet.x += (dx / dist) * pet.speed * dt;
      pet.z += (dz / dist) * pet.speed * dt;
    }
    pet.wag += dt * (idx === activeCompanion ? 11 : 7);
  });
}

function updateWildlife(dt) {
  for (const animal of wildlife) {
    animal.dir += Math.sin((animal.x + animal.z) * 0.00043) * 0.038;
    animal.x = clamp(animal.x + Math.cos(animal.dir) * animal.speed * dt, 24, world.width - 24);
    animal.z = clamp(animal.z + Math.sin(animal.dir) * animal.speed * dt, 24, world.depth - 24);
    if (Math.random() < 0.005) animal.dir += (Math.random() - 0.5) * 1.7;
  }
}

function handleInteractions() {
  if (justPressed.has("f")) {
    const npc = nearestEntity(npcs, 220);
    if (npc) {
      setMessage(`${npc.name}: ${npc.line}`);
      return;
    }
    const pet = nearestEntity(adoptablePets, 180);
    if (pet && !companions.some((c) => c.kind === pet.kind)) {
      companions.push({ kind: pet.kind, color: pet.color, x: player.x - 36, z: player.z + 34, speed: 180, wag: 0 });
      setMessage(`You adopted ${pet.kind}. Press P to cycle companions.`);
      return;
    }
  }

  if (justPressed.has("p") && companions.length > 1) {
    activeCompanion = (activeCompanion + 1) % companions.length;
    setMessage(`${companions[activeCompanion].kind} is now active.`);
  }

  const town = nearestTown(420);
  if (justPressed.has("b") && town) {
    buildMode = !buildMode;
    setMessage(buildMode ? `Build mode enabled in ${town.name}. Use 1/2/3.` : "Build mode disabled.");
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
    if (Math.hypot(player.x - falls.x, player.z - falls.z) < 260) discoveredFalls.add(falls.name);
  }
}

function render(time) {
  const w = canvas.width;
  const h = canvas.height;
  const horizon = h * 0.42;
  const camScale = 780;

  drawSky(time, horizon);
  drawFarMountains(horizon, time);
  drawGround(horizon, camScale, time);
  drawSceneObjects(horizon, camScale, time);
  drawPostEffects(time);
}

function drawSky(time, horizon) {
  const grad = ctx.createLinearGradient(0, 0, 0, horizon);
  grad.addColorStop(0, "#9db9d6");
  grad.addColorStop(0.45, "#c9d6e4");
  grad.addColorStop(1, "#f0b77b");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, horizon);

  const sunX = canvas.width * 0.74;
  const sunY = horizon * 0.36;
  const glow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 170);
  glow.addColorStop(0, "rgba(255,242,204,0.95)");
  glow.addColorStop(1, "rgba(255,242,204,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 170, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 8; i += 1) {
    const cx = ((i * 240 + time * (8 + i)) % (canvas.width + 380)) - 160;
    const cy = 34 + (i % 3) * 22 + Math.sin(time * 0.23 + i) * 6;
    drawCloud(cx, cy, 0.7 + (i % 3) * 0.25);
  }
}

function drawCloud(x, y, scale) {
  ctx.fillStyle = "rgba(255,255,255,0.34)";
  ctx.beginPath();
  ctx.ellipse(x, y, 90 * scale, 30 * scale, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 58 * scale, y + 3, 70 * scale, 24 * scale, 0, 0, Math.PI * 2);
  ctx.ellipse(x - 60 * scale, y + 4, 66 * scale, 24 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawFarMountains(horizon, time) {
  ctx.fillStyle = "#64707a";
  ctx.beginPath();
  ctx.moveTo(0, horizon + 46);
  for (let x = 0; x <= canvas.width; x += 10) {
    const nx = x / canvas.width;
    const y = horizon + 24 + Math.sin(nx * 11 + time * 0.03) * 26 + Math.cos(nx * 20) * 13;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(canvas.width, horizon + 96);
  ctx.lineTo(0, horizon + 96);
  ctx.closePath();
  ctx.fill();
}

function drawGround(horizon, camScale, time) {
  const stepY = 2;
  for (let sy = Math.floor(horizon); sy < canvas.height; sy += stepY) {
    const dist = (player.y * camScale) / Math.max(1, sy - horizon);
    const rowStepX = dist > 2600 ? 4 : dist > 1400 ? 3 : 2;

    for (let sx = 0; sx < canvas.width; sx += rowStepX) {
      const ray = player.angle + ((sx / canvas.width) - 0.5) * FOV;
      const wx = player.x + Math.cos(ray) * dist;
      const wz = player.z + Math.sin(ray) * dist;

      const biome = getBiome(wx, wz);
      let col = terrainColor(biome, wx, wz, time);

      const normal = terrainNormal(wx, wz);
      const diffuse = clamp(normal.x * sun.x + normal.y * sun.y + normal.z * sun.z, 0.15, 1);
      col = shadeColor(col, (diffuse - 0.6) * 56);

      const fog = clamp(dist / 3200, 0, 0.78);
      col = mixColor(col, "#a9b4be", fog);

      ctx.fillStyle = col;
      ctx.fillRect(sx, sy, rowStepX + 1, stepY + 1);
    }
  }
}

function drawSceneObjects(horizon, camScale, time) {
  const objects = [];
  for (const tree of nearestChunk(trees, 2500)) {
    objects.push({ type: "tree", x: tree.x, z: tree.z, tree });
  }

  for (const town of towns) objects.push({ type: "town", x: town.x, z: town.z, town });
  for (const npc of npcs) objects.push({ type: "npc", x: npc.x, z: npc.z, npc });
  for (const pet of adoptablePets) objects.push({ type: "adopt", x: pet.x, z: pet.z, pet });
  for (const animal of wildlife) objects.push({ type: "animal", x: animal.x, z: animal.z, animal });
  for (const falls of waterfalls) objects.push({ type: "falls", x: falls.x, z: falls.z, falls });
  companions.forEach((pet, idx) => objects.push({ type: "companion", x: pet.x, z: pet.z, pet, idx }));

  const visible = [];
  for (const obj of objects) {
    const p = project(obj.x, obj.z, horizon, camScale);
    if (!p || p.depth > 3600 || p.screenX < -200 || p.screenX > canvas.width + 200) continue;
    visible.push({ ...obj, ...p });
  }

  visible.sort((a, b) => b.depth - a.depth);
  for (const obj of visible) {
    switch (obj.type) {
      case "tree": drawTree(obj); break;
      case "town": drawTown(obj); break;
      case "npc": drawPerson(obj, "#405f96", 62); break;
      case "adopt":
        drawPet(obj.screenX, obj.groundY, obj.scale, obj.pet.color, false, time * 2);
        drawLabel(obj.pet.kind, obj.screenX + 8, obj.groundY - 24);
        break;
      case "animal": drawAnimal(obj); break;
      case "falls": drawWaterfall(obj, time); break;
      case "companion": drawPet(obj.screenX, obj.groundY, obj.scale, obj.pet.color, obj.idx === activeCompanion, obj.pet.wag); break;
      default: break;
    }
  }

  drawPlayerHands(time);
}

function drawShadow(x, y, size, alpha) {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x, y, size, size * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawTree(obj) {
  const t = obj.tree;
  const crown = obj.scale * t.w;
  const trunkW = obj.scale * t.trunk;
  const trunkH = obj.scale * (t.h * 0.4);

  drawShadow(obj.screenX, obj.groundY + 2, crown * 0.7, 0.28);

  ctx.fillStyle = "#68462d";
  ctx.fillRect(obj.screenX - trunkW / 2, obj.groundY - trunkH, trunkW, trunkH);

  const grad = ctx.createRadialGradient(
    obj.screenX - crown * 0.25,
    obj.groundY - trunkH - crown * 0.8,
    crown * 0.2,
    obj.screenX,
    obj.groundY - trunkH - crown * 0.8,
    crown
  );
  grad.addColorStop(0, shadeColor(t.color, 30));
  grad.addColorStop(1, shadeColor(t.color, -24));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(obj.screenX, obj.groundY - trunkH - crown * 0.8, crown, 0, Math.PI * 2);
  ctx.fill();
}

function drawTown(obj) {
  const wallColors = ["#c58f6d", "#8ca0b5", "#d8c89d"];
  const roofColors = ["#894938", "#586274", "#6f8a4f"];
  const decorColors = ["#f4b35f", "#9ed5b5", "#f7e39a"];

  const w = obj.scale * 56;
  const h = obj.scale * 34;
  drawShadow(obj.screenX, obj.groundY + 2, w * 0.65, 0.25);

  ctx.fillStyle = wallColors[obj.town.home.wall];
  ctx.fillRect(obj.screenX - w / 2, obj.groundY - h, w, h);

  ctx.fillStyle = roofColors[obj.town.home.roof];
  ctx.beginPath();
  ctx.moveTo(obj.screenX - w * 0.62, obj.groundY - h);
  ctx.lineTo(obj.screenX, obj.groundY - h - obj.scale * 24);
  ctx.lineTo(obj.screenX + w * 0.62, obj.groundY - h);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = decorColors[obj.town.home.decor];
  ctx.fillRect(obj.screenX - obj.scale * 11, obj.groundY - obj.scale * 14, obj.scale * 22, obj.scale * 9);

  ctx.fillStyle = "rgba(255, 228, 167, 0.65)";
  ctx.fillRect(obj.screenX - obj.scale * 19, obj.groundY - obj.scale * 18, obj.scale * 7, obj.scale * 7);
  ctx.fillRect(obj.screenX + obj.scale * 12, obj.groundY - obj.scale * 18, obj.scale * 7, obj.scale * 7);

  drawLabel(obj.town.name, obj.screenX - w * 0.48, obj.groundY - h - obj.scale * 16);
}

function drawPerson(obj, bodyColor, h) {
  drawShadow(obj.screenX, obj.groundY + 1, obj.scale * 9, 0.24);
  const r = obj.scale * 6;
  ctx.fillStyle = bodyColor;
  ctx.fillRect(obj.screenX - r, obj.groundY - obj.scale * h, r * 2, obj.scale * (h - 12));
  ctx.fillStyle = "#f2d4ae";
  ctx.beginPath();
  ctx.arc(obj.screenX, obj.groundY - obj.scale * h, obj.scale * 6, 0, Math.PI * 2);
  ctx.fill();
  drawLabel(obj.npc.name, obj.screenX - obj.scale * 14, obj.groundY - obj.scale * (h + 14));
}

function drawPet(x, y, scale, color, active, wag) {
  const bodyW = scale * (active ? 26 : 20);
  const bodyH = scale * (active ? 16 : 12.5);
  drawShadow(x, y + 1, bodyW * 0.52, 0.2);

  const grad = ctx.createLinearGradient(x - bodyW, y - bodyH * 1.2, x + bodyW, y);
  grad.addColorStop(0, shadeColor(color, 20));
  grad.addColorStop(1, shadeColor(color, -16));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(x, y - bodyH * 0.6, bodyW * 0.5, bodyH * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = shadeColor(color, -26);
  ctx.lineWidth = Math.max(1, scale * 3);
  ctx.beginPath();
  ctx.moveTo(x - bodyW * 0.45, y - bodyH * 0.68);
  ctx.quadraticCurveTo(x - bodyW * 0.6 + Math.sin(wag) * scale * 8, y - bodyH, x - bodyW * 0.8, y - bodyH * 0.62);
  ctx.stroke();
}

function drawAnimal(obj) {
  const w = obj.scale * (obj.animal.type === "Deer" ? 21 : 14);
  const h = obj.scale * (obj.animal.type === "Deer" ? 13.5 : 9);
  drawShadow(obj.screenX, obj.groundY + 1, w * 0.45, 0.18);
  ctx.fillStyle = obj.animal.color;
  ctx.beginPath();
  ctx.ellipse(obj.screenX, obj.groundY - h * 0.6, w * 0.5, h * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawWaterfall(obj, time) {
  const h = obj.scale * 64;
  const w = obj.scale * 26;
  drawShadow(obj.screenX, obj.groundY + 2, w * 0.7, 0.2);

  const grad = ctx.createLinearGradient(obj.screenX, obj.groundY - h, obj.screenX, obj.groundY);
  grad.addColorStop(0, "rgba(207,242,255,0.95)");
  grad.addColorStop(1, "rgba(124,196,227,0.65)");
  ctx.fillStyle = grad;
  ctx.fillRect(obj.screenX - w * 0.5, obj.groundY - h, w, h);

  ctx.fillStyle = `rgba(170,224,255,${0.24 + Math.sin(time * 4.3) * 0.1})`;
  ctx.beginPath();
  ctx.ellipse(obj.screenX, obj.groundY - 2, w * 1.36, obj.scale * 8, 0, 0, Math.PI * 2);
  ctx.fill();
  drawLabel(obj.falls.name, obj.screenX - w * 1.25, obj.groundY - h - obj.scale * 10);
}

function drawPostEffects(time) {
  const vignette = ctx.createRadialGradient(
    canvas.width / 2,
    canvas.height / 2,
    canvas.height * 0.2,
    canvas.width / 2,
    canvas.height / 2,
    canvas.height * 0.75
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.22)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = `rgba(255,244,225,${0.06 + Math.sin(time * 0.8) * 0.03})`;
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i += 1) {
    const y = canvas.height * 0.45 + i * 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

function drawLabel(text, x, y) {
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(x - 3, y - 11, Math.max(34, text.length * 7.2), 14);
  ctx.fillStyle = "#ffeec5";
  ctx.font = "12px sans-serif";
  ctx.fillText(text, x, y);
}

function drawPlayerHands(time) {
  const y = canvas.height - 36 + Math.sin(time * 8 + player.walkTime) * 2;
  ctx.fillStyle = "#324066";
  ctx.fillRect(canvas.width * 0.24 - 70, y, 132, 44);
  ctx.fillRect(canvas.width * 0.76 - 60, y, 120, 44);
}

function updateHud() {
  const town = nearestTown(420);
  const biome = biomeNames[getBiome(player.x, player.z)];
  statusEl.textContent = [
    "Mode: Enhanced 3D",
    `Biome: ${biome}`,
    `Companion: ${companions[activeCompanion].kind} (${activeCompanion + 1}/${companions.length})`,
    `Discovered: ${discoveredBiomes.size}/${Object.keys(biomeNames).length}`,
    `Waterfalls: ${discoveredFalls.size}/${waterfalls.length}`,
    town ? `Town: ${town.name}${buildMode ? " (Build Mode)" : ""}` : "Town: wilderness",
  ].join("  •  ");

  dialogueEl.textContent = messageTimer > 0
    ? message
    : "WASD move, Arrow Left/Right or Q/E turn, F interact, B build in town, P swap pet, Shift sprint.";
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
  const noise = Math.sin(x * 0.00077) + Math.cos(z * 0.00091) + Math.sin((x + z) * 0.00021);
  if (riverD < 84) return "lakeside";
  if (noise > 1.25) return "mountain";
  if (noise > 0.25) return "autumn";
  if (noise > -0.48) return "pine";
  return "meadow";
}

function terrainHeight(x, z) {
  const undulate = Math.sin(x * 0.0019) * 27 + Math.cos(z * 0.0017) * 24 + Math.sin((x + z) * 0.00085) * 18;
  const mnt = Math.max(0, Math.sin(x * 0.00062 + 0.7) + Math.cos(z * 0.00061) - 1.0) * 155;
  const river = Math.max(0, 78 - distanceToRiver(x, z)) * 0.62;
  return undulate + mnt - river;
}

function terrainNormal(x, z) {
  const eps = 22;
  const hL = terrainHeight(x - eps, z);
  const hR = terrainHeight(x + eps, z);
  const hD = terrainHeight(x, z - eps);
  const hU = terrainHeight(x, z + eps);
  const nx = hL - hR;
  const ny = eps * 2;
  const nz = hD - hU;
  const len = Math.hypot(nx, ny, nz) || 1;
  return { x: nx / len, y: ny / len, z: nz / len };
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
  const flicker = (Math.sin(x * 0.008 + time * 0.25) + Math.cos(z * 0.008)) * 4;
  const riverDistance = distanceToRiver(x, z);
  if (riverDistance < 72) {
    const wave = Math.sin((x + time * 180) * 0.02) + Math.cos((z - time * 130) * 0.018);
    return shadeColor("#4f9fca", flicker + wave * 5);
  }

  switch (biome) {
    case "mountain": return shadeColor("#66707b", flicker);
    case "pine": return shadeColor("#34533f", flicker);
    case "meadow": return shadeColor("#8b8241", flicker);
    case "lakeside": return shadeColor("#4e8f98", flicker);
    default: return shadeColor("#5d643e", flicker);
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
  const a = parseColor(c1);
  const b = parseColor(c2);
  return `rgb(${Math.round(a.r + (b.r - a.r) * t)}, ${Math.round(a.g + (b.g - a.g) * t)}, ${Math.round(a.b + (b.b - a.b) * t)})`;
}

function parseColor(value) {
  if (value.startsWith("rgb")) {
    const parts = value.match(/\d+(?:\.\d+)?/g) || [0, 0, 0];
    return { r: Number(parts[0]) || 0, g: Number(parts[1]) || 0, b: Number(parts[2]) || 0 };
  }
  const h = value.replace("#", "");
  const n = Number.parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function shadeColor(hex, amount) {
  const rgb = parseColor(hex);
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

import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";

const canvas = document.getElementById("game");
const statusEl = document.getElementById("status");
const dialogueEl = document.getElementById("dialogue");
const creatorEl = document.getElementById("creator");
const startBtn = document.getElementById("startBtn");
const nameInput = document.getElementById("nameInput");
const skinInput = document.getElementById("skinInput");
const jacketInput = document.getElementById("jacketInput");
const hairInput = document.getElementById("hairInput");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setSize(canvas.clientWidth || canvas.width, canvas.clientHeight || canvas.height, false);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.03;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x9daab3, 120, 820);

const camera = new THREE.PerspectiveCamera(66, canvas.width / canvas.height, 0.1, 2000);
camera.position.set(0, 12, 18);

scene.add(new THREE.HemisphereLight(0xcbdfff, 0x3b3d2d, 0.72));
const sun = new THREE.DirectionalLight(0xffddb0, 1.35);
sun.position.set(110, 180, -60);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -220;
sun.shadow.camera.right = 220;
sun.shadow.camera.top = 220;
sun.shadow.camera.bottom = -220;
scene.add(sun);

const sky = new THREE.Mesh(
  new THREE.SphereGeometry(1200, 30, 18),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      topColor: { value: new THREE.Color("#7a97ba") },
      horizonColor: { value: new THREE.Color("#e2b384") },
      bottomColor: { value: new THREE.Color("#263327") },
    },
    vertexShader: `varying vec3 vWorld; void main(){ vec4 wp=modelMatrix*vec4(position,1.0); vWorld=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: `varying vec3 vWorld; uniform vec3 topColor; uniform vec3 horizonColor; uniform vec3 bottomColor; void main(){ float h=normalize(vWorld).y*0.5+0.5; vec3 c=mix(bottomColor,horizonColor,smoothstep(0.0,0.45,h)); c=mix(c,topColor,smoothstep(0.45,1.0,h)); gl_FragColor=vec4(c,1.0);} `,
  })
);
scene.add(sky);

function terrainHeight(x, z) {
  return Math.sin(x * 0.024) * 0.5 + Math.cos(z * 0.02) * 0.45;
}

const townSize = 420;
const terrainGeo = new THREE.PlaneGeometry(townSize, townSize, 140, 140);
terrainGeo.rotateX(-Math.PI / 2);
const pos = terrainGeo.attributes.position;
const colors = [];
for (let i = 0; i < pos.count; i += 1) {
  const x = pos.getX(i);
  const z = pos.getZ(i);
  const y = terrainHeight(x, z);
  pos.setY(i, y);
  const isRoad = Math.abs(x) < 16 || Math.abs(z) < 16;
  const edgeForest = Math.hypot(x, z) > 150;
  const c = isRoad ? new THREE.Color("#7a6f61") : edgeForest ? new THREE.Color("#48593f") : new THREE.Color("#63714a");
  colors.push(c.r, c.g, c.b);
}
terrainGeo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
terrainGeo.computeVertexNormals();

const ground = new THREE.Mesh(
  terrainGeo,
  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0.01 })
);
ground.receiveShadow = true;
scene.add(ground);

const roadDetail = new THREE.Mesh(
  new THREE.PlaneGeometry(320, 28),
  new THREE.MeshStandardMaterial({ color: 0x8a7d6f, roughness: 0.9 })
);
roadDetail.rotation.x = -Math.PI / 2;
roadDetail.position.set(0, 0.08, 0);
roadDetail.receiveShadow = true;
scene.add(roadDetail);

const roadCross = roadDetail.clone();
roadCross.geometry = new THREE.PlaneGeometry(28, 320);
scene.add(roadCross);

function addLamp(x, z) {
  const y = terrainHeight(x, z);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 7.2, 8), new THREE.MeshStandardMaterial({ color: 0x383838, roughness: 0.8 }));
  pole.position.set(x, y + 3.6, z);
  pole.castShadow = true;
  scene.add(pole);

  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 10), new THREE.MeshStandardMaterial({ color: 0xffdc9c, emissive: 0x9f6f1f, emissiveIntensity: 0.6 }));
  bulb.position.set(x, y + 7.3, z);
  scene.add(bulb);

  const glow = new THREE.PointLight(0xffc176, 0.45, 30, 2);
  glow.position.set(x, y + 7, z);
  scene.add(glow);
}

[-80, -30, 30, 80].forEach((n) => addLamp(n, 14));
[-80, -30, 30, 80].forEach((n) => addLamp(14, n));

const houseStyles = [0xb8926d, 0x8ba4b4, 0xd4c39f];
const roofStyles = [0x7d4535, 0x5b6574, 0x637d48];
const townState = { wall: 0, roof: 0, decor: 0 };
const houses = [];

function addHouse(x, z, scale = 1) {
  const y = terrainHeight(x, z);
  const g = new THREE.Group();

  const body = new THREE.Mesh(new THREE.BoxGeometry(14 * scale, 10 * scale, 13 * scale), new THREE.MeshStandardMaterial({ color: houseStyles[0], roughness: 0.88 }));
  body.position.y = 5 * scale;

  const roof = new THREE.Mesh(new THREE.ConeGeometry(10 * scale, 6.4 * scale, 6), new THREE.MeshStandardMaterial({ color: roofStyles[0], roughness: 0.78 }));
  roof.position.y = 13 * scale;
  roof.rotation.y = Math.PI / 6;

  const door = new THREE.Mesh(new THREE.BoxGeometry(2.6 * scale, 4.6 * scale, 0.2 * scale), new THREE.MeshStandardMaterial({ color: 0x4c2f1f }));
  door.position.set(0, 2.3 * scale, 6.6 * scale);

  const winMat = new THREE.MeshStandardMaterial({ color: 0xffda9f, emissive: 0x8c5e1f, emissiveIntensity: 0.35 });
  const w1 = new THREE.Mesh(new THREE.BoxGeometry(2.1 * scale, 1.7 * scale, 0.2 * scale), winMat);
  const w2 = w1.clone();
  w1.position.set(-3.8 * scale, 5 * scale, 6.6 * scale);
  w2.position.set(3.8 * scale, 5 * scale, 6.6 * scale);

  g.add(body, roof, door, w1, w2);
  g.position.set(x, y, z);
  g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  scene.add(g);
  houses.push(g);
}

addHouse(-60, -56, 1.1);
addHouse(56, -56, 1.05);
addHouse(-60, 56, 1.0);
addHouse(56, 56, 1.15);
addHouse(0, -88, 1.2);

const market = new THREE.Group();
for (let i = 0; i < 4; i += 1) {
  const x = -18 + i * 12;
  const z = -8;
  const y = terrainHeight(x, z);
  const stall = new THREE.Group();
  const table = new THREE.Mesh(new THREE.BoxGeometry(8, 2.4, 4.5), new THREE.MeshStandardMaterial({ color: 0x7a5435 }));
  table.position.y = 1.2;
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.8, 5.2), new THREE.MeshStandardMaterial({ color: i % 2 ? 0x8c3a2f : 0x325d94 }));
  canopy.position.y = 4.7;
  stall.add(table, canopy);
  stall.position.set(x, y, z);
  stall.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  market.add(stall);
}
scene.add(market);

const trees = new THREE.Group();
const trunkGeo = new THREE.CylinderGeometry(0.7, 1.05, 9.8, 10);
const leafGeo = new THREE.IcosahedronGeometry(4.8, 1);
const trunkMat = new THREE.MeshStandardMaterial({ color: 0x684629, roughness: 0.94 });
const leafPalette = [0xcc6c2c, 0xa8432b, 0xf0bf52, 0x4c7448];
for (let i = 0; i < 220; i += 1) {
  const a = Math.random() * Math.PI * 2;
  const r = 145 + Math.random() * 60;
  const x = Math.cos(a) * r;
  const z = Math.sin(a) * r;
  const y = terrainHeight(x, z);

  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.set(x, y + 4.9, z);
  trunk.castShadow = true;
  trees.add(trunk);

  const crown = new THREE.Mesh(leafGeo, new THREE.MeshStandardMaterial({ color: leafPalette[Math.floor(Math.random() * leafPalette.length)], roughness: 0.8 }));
  crown.position.set(x, y + 11.2, z);
  crown.scale.set(0.9 + Math.random() * 0.8, 1 + Math.random() * 1.1, 0.9 + Math.random() * 0.8);
  crown.castShadow = true;
  trees.add(crown);
}
scene.add(trees);

const npc = new THREE.Group();
const npcBody = new THREE.Mesh(new THREE.CapsuleGeometry(1.15, 3.4, 4, 12), new THREE.MeshStandardMaterial({ color: 0x3f5f97 }));
const npcHead = new THREE.Mesh(new THREE.SphereGeometry(0.95, 14, 12), new THREE.MeshStandardMaterial({ color: 0xe6c3a4 }));
npcHead.position.y = 2.9;
npc.add(npcBody, npcHead);
npc.position.set(10, terrainHeight(10, 10) + 2.5, 10);
npc.traverse((m) => { if (m.isMesh) m.castShadow = true; });
scene.add(npc);

const player = { pos: new THREE.Vector3(-20, terrainHeight(-20, -20) + 3.2, -20), yaw: 0.35, speed: 22 };
const playerAvatar = new THREE.Group();
const avatarBody = new THREE.Mesh(new THREE.CapsuleGeometry(1.2, 3.8, 4, 12), new THREE.MeshStandardMaterial({ color: 0x3b6a9e }));
const avatarHead = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 14), new THREE.MeshStandardMaterial({ color: 0xe0b89a }));
const avatarHair = new THREE.Mesh(new THREE.SphereGeometry(1.03, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshStandardMaterial({ color: 0x3f2a1e }));
avatarHead.position.y = 3.15;
avatarHair.position.y = 3.45;
playerAvatar.add(avatarBody, avatarHead, avatarHair);
playerAvatar.position.copy(player.pos).add(new THREE.Vector3(0, -1.6, 0));
playerAvatar.traverse((m) => { if (m.isMesh) m.castShadow = true; });
scene.add(playerAvatar);

const petData = [
  { kind: "Dog", color: 0x8f6a43 },
  { kind: "Fox", color: 0xcd7330 },
  { kind: "Cat", color: 0x8f92a4 },
];
let activePet = 0;
const companions = petData.map((pet, idx) => {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.56, 1.1, 4, 10), new THREE.MeshStandardMaterial({ color: pet.color }));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.52, 12, 10), new THREE.MeshStandardMaterial({ color: pet.color }));
  head.position.set(0.78, 0.42, 0);
  g.add(body, head);
  g.position.copy(player.pos).add(new THREE.Vector3(-2 - idx * 1.7, -1.2, 2.2 + idx * 1.4));
  g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  scene.add(g);
  return g;
});

const keys = new Set();
let dragging = false;
let lastX = 0;
let started = false;
let buildMode = false;
let info = "Character creator ready. Enter town when ready.";
let infoTimer = 999;

window.addEventListener("keydown", (e) => keys.add(e.key.toLowerCase()));
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
canvas.addEventListener("mousedown", (e) => { dragging = true; lastX = e.clientX; });
window.addEventListener("mouseup", () => { dragging = false; });
window.addEventListener("mousemove", (e) => {
  if (!dragging || !started) return;
  const dx = e.clientX - lastX;
  lastX = e.clientX;
  player.yaw -= dx * 0.004;
});

function groundAt(x, z) {
  return terrainHeight(x, z) + 3.2;
}

function updateTownStyles() {
  houses.forEach((home, idx) => {
    home.children[0].material.color.setHex(houseStyles[(townState.wall + idx) % houseStyles.length]);
    home.children[1].material.color.setHex(roofStyles[(townState.roof + idx) % roofStyles.length]);
  });
}

function tryInteract() {
  if (npc.position.distanceTo(player.pos) < 16) {
    info = "Guild Keeper: Welcome to Oakrise. Detailed town first, wilderness second.";
    infoTimer = 5.5;
  }
}

startBtn.addEventListener("click", () => {
  avatarHead.material.color.set(skinInput.value);
  avatarBody.material.color.set(jacketInput.value);
  avatarHair.material.color.set(hairInput.value);
  started = true;
  creatorEl.style.display = "none";
  info = `${nameInput.value || "Ranger"}, welcome to Oakrise Town.`;
  infoTimer = 5;
});

let prevF = false;
let prevB = false;
let prevP = false;
let prev1 = false;
let prev2 = false;
let prev3 = false;
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.033);
  const t = clock.elapsedTime;

  if (started) {
    const forward = new THREE.Vector3(Math.cos(player.yaw), 0, Math.sin(player.yaw));
    const right = new THREE.Vector3(-forward.z, 0, forward.x);

    let move = 0;
    let strafe = 0;
    if (keys.has("w")) move += 1;
    if (keys.has("s")) move -= 1;
    if (keys.has("a")) strafe -= 1;
    if (keys.has("d")) strafe += 1;
    if (keys.has("q") || keys.has("arrowleft")) player.yaw += dt * 1.8;
    if (keys.has("e") || keys.has("arrowright")) player.yaw -= dt * 1.8;

    const sprint = keys.has("shift") ? 1.45 : 1;
    player.pos.addScaledVector(forward, move * player.speed * sprint * dt);
    player.pos.addScaledVector(right, strafe * player.speed * sprint * dt);
    player.pos.x = THREE.MathUtils.clamp(player.pos.x, -190, 190);
    player.pos.z = THREE.MathUtils.clamp(player.pos.z, -190, 190);
    player.pos.y = THREE.MathUtils.lerp(player.pos.y, groundAt(player.pos.x, player.pos.z), dt * 8);

    playerAvatar.position.set(player.pos.x, groundAt(player.pos.x, player.pos.z) - 1.6, player.pos.z);
    playerAvatar.rotation.y = -player.yaw + Math.PI / 2;

    companions.forEach((pet, idx) => {
      const radius = 4 + idx * 1.7;
      const isLead = idx === activePet;
      const angle = player.yaw + Math.PI + idx * 0.72;
      const target = player.pos.clone().add(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
      if (isLead) target.add(new THREE.Vector3(Math.cos(player.yaw + Math.PI) * 1.4, 0, Math.sin(player.yaw + Math.PI) * 1.4));
      pet.position.lerp(target.setY(groundAt(target.x, target.z) - 1.2 + Math.sin(t * 4 + idx) * 0.03), dt * 3.3);
      pet.scale.setScalar(isLead ? 1.12 : 1.0);
    });

    npc.position.y = groundAt(npc.position.x, npc.position.z) - 0.45;
    waterfall.material.opacity = 0.52 + Math.sin(t * 5.2) * 0.11;

    const target = player.pos.clone().add(new THREE.Vector3(0, 2.9, 0));
    const back = new THREE.Vector3(Math.cos(player.yaw), 0, Math.sin(player.yaw)).multiplyScalar(-11);
    const camPos = target.clone().add(back).add(new THREE.Vector3(0, 6.8, 0));
    camPos.y = Math.max(camPos.y, groundAt(camPos.x, camPos.z) + 1.8);
    camera.position.lerp(camPos, dt * 7);
    camera.lookAt(target);

    const fNow = keys.has("f");
    if (fNow && !prevF) tryInteract();
    prevF = fNow;

    const pNow = keys.has("p");
    if (pNow && !prevP) {
      activePet = (activePet + 1) % companions.length;
      info = `Lead companion: ${petData[activePet].kind}. Pack keeps following.`;
      infoTimer = 4;
    }
    prevP = pNow;

    const bNow = keys.has("b");
    if (bNow && !prevB && player.pos.distanceTo(new THREE.Vector3(0, player.pos.y, 0)) < 90) {
      buildMode = !buildMode;
      info = buildMode ? "Decorate mode enabled near town center." : "Decorate mode disabled.";
      infoTimer = 4;
    }
    prevB = bNow;

    if (buildMode) {
      const k1 = keys.has("1");
      const k2 = keys.has("2");
      const k3 = keys.has("3");
      if (k1 && !prev1) townState.wall = (townState.wall + 1) % houseStyles.length;
      if (k2 && !prev2) townState.roof = (townState.roof + 1) % roofStyles.length;
      if (k3 && !prev3) townState.decor = (townState.decor + 1) % 3;
      prev1 = k1;
      prev2 = k2;
      prev3 = k3;
      updateTownStyles();
      market.children.forEach((stall, idx) => {
        stall.children[1].material.color.setHex([0x8c3a2f, 0x325d94, 0x547a2f][(townState.decor + idx) % 3]);
      });
    } else {
      prev1 = prev2 = prev3 = false;
    }
  }

  if (infoTimer > 0 && started) infoTimer -= dt;

  statusEl.textContent = `Mode: Detailed Town • Player: ${nameInput.value || "Ranger"} • Lead Pet: ${petData[activePet].kind} • Pack: ${companions.length} • Houses: ${houses.length} • Trees: ${Math.round(trees.children.length / 2)}${buildMode ? " • Decorate Mode" : ""}`;
  dialogueEl.textContent = !started
    ? "Create your character and enter the town."
    : (infoTimer > 0 ? info : "Oakrise is focused on sharp town detail with a small forest ring around it.");

  renderer.render(scene, camera);
}

updateTownStyles();
animate();

window.addEventListener("resize", () => {
  const w = canvas.clientWidth || canvas.width;
  const h = canvas.clientHeight || canvas.height;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
});

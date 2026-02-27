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
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x9db2be, 260, 1550);

const camera = new THREE.PerspectiveCamera(68, canvas.width / canvas.height, 0.1, 3000);
camera.position.set(0, 16, 24);

scene.add(new THREE.HemisphereLight(0xcde0ff, 0x3f5a3f, 0.8));
const sun = new THREE.DirectionalLight(0xffe3b0, 1.35);
sun.position.set(180, 260, -120);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -300;
sun.shadow.camera.right = 300;
sun.shadow.camera.top = 300;
sun.shadow.camera.bottom = -300;
scene.add(sun);

const sky = new THREE.Mesh(
  new THREE.SphereGeometry(2200, 40, 20),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      topColor: { value: new THREE.Color("#89abcf") },
      horizonColor: { value: new THREE.Color("#f1c08c") },
      bottomColor: { value: new THREE.Color("#2f4130") },
    },
    vertexShader: `varying vec3 vWorld; void main(){ vec4 wp=modelMatrix*vec4(position,1.0); vWorld=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: `varying vec3 vWorld; uniform vec3 topColor; uniform vec3 horizonColor; uniform vec3 bottomColor; void main(){ float h=normalize(vWorld).y*0.5+0.5; vec3 c=mix(bottomColor,horizonColor,smoothstep(0.0,0.45,h)); c=mix(c,topColor,smoothstep(0.45,1.0,h)); gl_FragColor=vec4(c,1.0);} `,
  })
);
scene.add(sky);

const worldSize = 2200;
const terrainRes = 220;
const riverPath = (x) => Math.sin(x * 0.006) * 170 + Math.cos(x * 0.0016) * 80;

function terrainHeight(x, z) {
  const ridge = Math.max(0, Math.sin(x * 0.0022) + Math.cos(z * 0.0019) - 1.1) * 45;
  const hills = Math.sin(x * 0.009) * 7 + Math.cos(z * 0.008) * 6 + Math.sin((x + z) * 0.004) * 4;
  const riverCut = Math.max(0, 22 - Math.abs(z - riverPath(x))) * 0.65;
  return hills + ridge - riverCut;
}

function biomeColor(x, z) {
  const n = Math.sin(x * 0.0025) + Math.cos(z * 0.002);
  if (Math.abs(z - riverPath(x)) < 30) return new THREE.Color("#5f8f74");
  if (n > 1.0) return new THREE.Color("#74818a");
  if (n > 0.2) return new THREE.Color("#5f6b45");
  if (n > -0.5) return new THREE.Color("#3f5f45");
  return new THREE.Color("#8f8746");
}

const terrainGeo = new THREE.PlaneGeometry(worldSize, worldSize, terrainRes, terrainRes);
terrainGeo.rotateX(-Math.PI / 2);
const pos = terrainGeo.attributes.position;
const colors = [];
for (let i = 0; i < pos.count; i += 1) {
  const x = pos.getX(i);
  const z = pos.getZ(i);
  pos.setY(i, terrainHeight(x, z));
  const c = biomeColor(x, z);
  colors.push(c.r, c.g, c.b);
}
terrainGeo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
terrainGeo.computeVertexNormals();

const ground = new THREE.Mesh(
  terrainGeo,
  new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0.02 })
);
ground.receiveShadow = true;
scene.add(ground);

const riverPoints = [];
for (let x = -worldSize / 2; x <= worldSize / 2; x += 45) riverPoints.push(new THREE.Vector3(x, terrainHeight(x, riverPath(x)) + 0.3, riverPath(x)));
const riverCurve = new THREE.CatmullRomCurve3(riverPoints);
scene.add(new THREE.Mesh(
  new THREE.TubeGeometry(riverCurve, 220, 8.5, 14, false),
  new THREE.MeshPhysicalMaterial({ color: 0x58a7ce, roughness: 0.2, metalness: 0.1, transmission: 0.08 })
));

const waterfall = new THREE.Mesh(
  new THREE.PlaneGeometry(24, 82),
  new THREE.MeshStandardMaterial({ color: 0xbde8ff, transparent: true, opacity: 0.65, emissive: 0x5ea7cf, emissiveIntensity: 0.3, side: THREE.DoubleSide })
);
waterfall.position.set(320, terrainHeight(320, riverPath(320)) + 35, riverPath(320));
scene.add(waterfall);

const trees = new THREE.Group();
const trunkGeo = new THREE.CylinderGeometry(0.7, 1.1, 10, 10);
const crownGeo = new THREE.IcosahedronGeometry(4.8, 1);
const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6a472d, roughness: 0.95 });
const leafMats = [0xde6a2c, 0xc84727, 0xf4be4f, 0x3f6d45, 0xb89b45].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.82 }));
for (let i = 0; i < 1050; i += 1) {
  const x = (Math.random() - 0.5) * (worldSize - 140);
  const z = (Math.random() - 0.5) * (worldSize - 140);
  if (Math.abs(z - riverPath(x)) < 20) continue;
  const y = terrainHeight(x, z);

  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.set(x, y + 5, z);
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  trees.add(trunk);

  const crown = new THREE.Mesh(crownGeo, leafMats[Math.floor(Math.random() * leafMats.length)]);
  crown.position.set(x, y + 12, z);
  crown.scale.set(0.8 + Math.random() * 1.1, 1 + Math.random() * 1.1, 0.8 + Math.random() * 1.1);
  crown.castShadow = true;
  trees.add(crown);
}
scene.add(trees);

const town = { x: -200, z: -160, wall: 0, roof: 0, decor: 0 };
const townGroup = new THREE.Group();
const houseStyles = [0xc58f6d, 0x8ca0b5, 0xd8c89d];
const roofStyles = [0x894938, 0x586274, 0x6f8a4f];
for (let i = 0; i < 4; i += 1) {
  const hx = town.x + (i % 2) * 38 - 20;
  const hz = town.z + Math.floor(i / 2) * 38 - 20;
  const hy = terrainHeight(hx, hz);
  const home = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(16, 10, 14), new THREE.MeshStandardMaterial({ color: 0xb58b62 }));
  const roof = new THREE.Mesh(new THREE.ConeGeometry(11, 6.5, 6), new THREE.MeshStandardMaterial({ color: 0x7f4733 }));
  roof.rotation.y = Math.PI * 0.2;
  body.position.y = 5;
  roof.position.y = 13.5;
  home.add(body, roof);
  home.position.set(hx, hy, hz);
  home.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  townGroup.add(home);
}
scene.add(townGroup);

const npc = new THREE.Group();
const npcBody = new THREE.Mesh(new THREE.CapsuleGeometry(1.15, 3.6, 4, 12), new THREE.MeshStandardMaterial({ color: 0x405f96 }));
const npcHead = new THREE.Mesh(new THREE.SphereGeometry(0.95, 14, 12), new THREE.MeshStandardMaterial({ color: 0xe5c1a1 }));
npcHead.position.y = 3;
npc.add(npcBody, npcHead);
npc.position.set(town.x + 12, terrainHeight(town.x + 12, town.z + 10) + 2.6, town.z + 10);
npc.traverse((m) => { if (m.isMesh) m.castShadow = true; });
scene.add(npc);

const player = { pos: new THREE.Vector3(-260, terrainHeight(-260, -240) + 3.2, -240), yaw: 0.25, speed: 24 };

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
const companions = petData.map((p, idx) => {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.6, 1.2, 4, 10), new THREE.MeshStandardMaterial({ color: p.color }));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), new THREE.MeshStandardMaterial({ color: p.color }));
  head.position.set(0.8, 0.4, 0);
  g.add(body, head);
  g.position.copy(player.pos).add(new THREE.Vector3(-2 - idx * 1.8, -1.3, 2 + idx * 1.6));
  g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  scene.add(g);
  return g;
});

const keys = new Set();
let dragging = false;
let lastX = 0;
let buildMode = false;
let info = "Character creator ready. Build your look and start exploring.";
let infoTimer = 999;
let started = false;

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
  townGroup.children.forEach((home, idx) => {
    home.children[0].material.color.setHex(houseStyles[(town.wall + idx) % houseStyles.length]);
    home.children[1].material.color.setHex(roofStyles[(town.roof + idx) % roofStyles.length]);
  });
}

function tryInteract() {
  const dNpc = npc.position.distanceTo(player.pos);
  if (dNpc < 18) {
    info = "Ivy: Nice look. Keep everyone following, or tap P to set the lead companion.";
    infoTimer = 6;
  }
}

startBtn.addEventListener("click", () => {
  avatarHead.material.color.set(skinInput.value);
  avatarBody.material.color.set(jacketInput.value);
  avatarHair.material.color.set(hairInput.value);
  started = true;
  creatorEl.style.display = "none";
  info = `${nameInput.value || "Ranger"}, your adventure begins.`;
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

    let mv = 0;
    let st = 0;
    if (keys.has("w")) mv += 1;
    if (keys.has("s")) mv -= 1;
    if (keys.has("a")) st -= 1;
    if (keys.has("d")) st += 1;
    if (keys.has("q") || keys.has("arrowleft")) player.yaw += dt * 1.8;
    if (keys.has("e") || keys.has("arrowright")) player.yaw -= dt * 1.8;

    const sprint = keys.has("shift") ? 1.6 : 1;
    player.pos.addScaledVector(forward, mv * player.speed * sprint * dt);
    player.pos.addScaledVector(right, st * player.speed * sprint * dt);
    player.pos.x = THREE.MathUtils.clamp(player.pos.x, -worldSize / 2 + 20, worldSize / 2 - 20);
    player.pos.z = THREE.MathUtils.clamp(player.pos.z, -worldSize / 2 + 20, worldSize / 2 - 20);
    player.pos.y = THREE.MathUtils.lerp(player.pos.y, groundAt(player.pos.x, player.pos.z), dt * 8);

    playerAvatar.position.set(player.pos.x, groundAt(player.pos.x, player.pos.z) - 1.6, player.pos.z);
    playerAvatar.rotation.y = -player.yaw + Math.PI / 2;

    companions.forEach((pet, idx) => {
      const ring = 4.2 + idx * 1.8;
      const isLead = idx === activePet;
      const angle = player.yaw + Math.PI + idx * 0.75;
      const target = player.pos.clone().add(new THREE.Vector3(Math.cos(angle) * ring, 0, Math.sin(angle) * ring));
      if (isLead) target.add(new THREE.Vector3(Math.cos(player.yaw + Math.PI) * 1.3, 0, Math.sin(player.yaw + Math.PI) * 1.3));
      pet.position.lerp(target.setY(groundAt(target.x, target.z) - 1.2 + Math.sin(t * 4 + idx) * 0.04), dt * 3.4);
      pet.scale.setScalar(isLead ? 1.15 : 1.0);
    });

    npc.position.y = groundAt(npc.position.x, npc.position.z) - 0.4;
    waterfall.material.opacity = 0.56 + Math.sin(t * 5) * 0.12;

    const camTarget = player.pos.clone().add(new THREE.Vector3(0, 2.8, 0));
    const back = new THREE.Vector3(Math.cos(player.yaw), 0, Math.sin(player.yaw)).multiplyScalar(-11.5);
    const camPos = camTarget.clone().add(back).add(new THREE.Vector3(0, 6.6, 0));
    camPos.y = Math.max(camPos.y, groundAt(camPos.x, camPos.z) + 1.8);

    camera.position.lerp(camPos, dt * 7);
    camera.lookAt(camTarget);

    const fNow = keys.has("f");
    if (fNow && !prevF) tryInteract();
    prevF = fNow;

    const pNow = keys.has("p");
    if (pNow && !prevP) {
      activePet = (activePet + 1) % companions.length;
      info = `Lead companion set to ${petData[activePet].kind}. Others still follow.`;
      infoTimer = 4;
    }
    prevP = pNow;

    const bNow = keys.has("b");
    if (bNow && !prevB && player.pos.distanceTo(new THREE.Vector3(town.x, player.pos.y, town.z)) < 120) {
      buildMode = !buildMode;
      info = buildMode ? "Build mode enabled in Maple Hollow." : "Build mode disabled.";
      infoTimer = 4;
    }
    prevB = bNow;

    if (buildMode) {
      const k1 = keys.has("1");
      const k2 = keys.has("2");
      const k3 = keys.has("3");
      if (k1 && !prev1) town.wall = (town.wall + 1) % houseStyles.length;
      if (k2 && !prev2) town.roof = (town.roof + 1) % roofStyles.length;
      if (k3 && !prev3) town.decor = (town.decor + 1) % 3;
      prev1 = k1;
      prev2 = k2;
      prev3 = k3;
      updateTownStyles();
    } else {
      prev1 = prev2 = prev3 = false;
    }
  }

  if (infoTimer > 0 && started) infoTimer -= dt;
  const biome = (() => {
    const n = Math.sin(player.pos.x * 0.0025) + Math.cos(player.pos.z * 0.002);
    if (Math.abs(player.pos.z - riverPath(player.pos.x)) < 30) return "Lakeside";
    if (n > 1.0) return "Highlands";
    if (n > 0.2) return "Autumn Forest";
    if (n > -0.5) return "Pine Woods";
    return "Sunlit Meadow";
  })();

  statusEl.textContent = `Mode: High Fidelity WebGL • Biome: ${biome} • Player: ${nameInput.value || "Ranger"} • Lead Companion: ${petData[activePet].kind} • Pack: ${companions.length} • Town: Maple Hollow${buildMode ? " (Build Mode)" : ""}`;
  dialogueEl.textContent = !started
    ? "Set your character look, then click Start Adventure."
    : (infoTimer > 0
      ? info
      : "All companions follow by default. Press P to choose the lead companion while keeping the full pack together.");

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

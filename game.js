import * as THREE from "https://unpkg.com/three@0.161.0/build/three.module.js";

const canvas = document.getElementById("game");
const statusEl = document.getElementById("status");
const dialogueEl = document.getElementById("dialogue");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setSize(canvas.clientWidth || canvas.width, canvas.clientHeight || canvas.height, false);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x9cb2be, 220, 1600);

const camera = new THREE.PerspectiveCamera(70, canvas.width / canvas.height, 0.1, 3000);
camera.position.set(0, 16, 24);

const hemi = new THREE.HemisphereLight(0xcde0ff, 0x3f5a3f, 0.8);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffe3b0, 1.3);
sun.position.set(180, 260, -120);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -300;
sun.shadow.camera.right = 300;
sun.shadow.camera.top = 300;
sun.shadow.camera.bottom = -300;
scene.add(sun);

const skyGeo = new THREE.SphereGeometry(2200, 32, 16);
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  uniforms: {
    topColor: { value: new THREE.Color("#87a9cc") },
    horizonColor: { value: new THREE.Color("#f1c08c") },
    bottomColor: { value: new THREE.Color("#31422f") },
  },
  vertexShader: `varying vec3 vWorld; void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vWorld = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
  fragmentShader: `varying vec3 vWorld; uniform vec3 topColor; uniform vec3 horizonColor; uniform vec3 bottomColor; void main(){ float h = normalize(vWorld).y * 0.5 + 0.5; vec3 c = mix(bottomColor, horizonColor, smoothstep(0.0, 0.45, h)); c = mix(c, topColor, smoothstep(0.45, 1.0, h)); gl_FragColor = vec4(c,1.0); }`,
});
scene.add(new THREE.Mesh(skyGeo, skyMat));

const worldSize = 2200;
const terrainRes = 220;
const terrainGeo = new THREE.PlaneGeometry(worldSize, worldSize, terrainRes, terrainRes);
terrainGeo.rotateX(-Math.PI / 2);
const pos = terrainGeo.attributes.position;
const v = new THREE.Vector3();
const riverPathFn = (x) => Math.sin(x * 0.006) * 170 + Math.cos(x * 0.0016) * 80;

function terrainHeight(x, z) {
  const ridge = Math.max(0, Math.sin(x * 0.0022) + Math.cos(z * 0.0019) - 1.1) * 45;
  const hills = Math.sin(x * 0.009) * 7 + Math.cos(z * 0.008) * 6 + Math.sin((x + z) * 0.004) * 4;
  const river = Math.max(0, 22 - Math.abs(z - riverPathFn(x))) * 0.65;
  return hills + ridge - river;
}

function biomeColor(x, z) {
  const n = Math.sin(x * 0.0025) + Math.cos(z * 0.002);
  if (Math.abs(z - riverPathFn(x)) < 30) return new THREE.Color("#5f8f74");
  if (n > 1.0) return new THREE.Color("#74818a");
  if (n > 0.2) return new THREE.Color("#5f6b45");
  if (n > -0.5) return new THREE.Color("#3f5f45");
  return new THREE.Color("#8f8746");
}

const colors = [];
for (let i = 0; i < pos.count; i += 1) {
  v.fromBufferAttribute(pos, i);
  v.y = terrainHeight(v.x, v.z);
  pos.setY(i, v.y);
  const c = biomeColor(v.x, v.z);
  colors.push(c.r, c.g, c.b);
}
terrainGeo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
terrainGeo.computeVertexNormals();

const ground = new THREE.Mesh(
  terrainGeo,
  new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.9,
    metalness: 0.02,
    flatShading: false,
  })
);
ground.receiveShadow = true;
scene.add(ground);

const riverPoints = [];
for (let x = -worldSize / 2; x <= worldSize / 2; x += 40) {
  riverPoints.push(new THREE.Vector3(x, terrainHeight(x, riverPathFn(x)) + 0.28, riverPathFn(x)));
}
const riverCurve = new THREE.CatmullRomCurve3(riverPoints);
const river = new THREE.Mesh(
  new THREE.TubeGeometry(riverCurve, 240, 9, 10, false),
  new THREE.MeshPhysicalMaterial({ color: 0x58a7ce, roughness: 0.14, metalness: 0.1, transmission: 0.08, clearcoat: 0.3 })
);
scene.add(river);

const waterfall = new THREE.Mesh(
  new THREE.PlaneGeometry(25, 80),
  new THREE.MeshStandardMaterial({ color: 0xbde8ff, transparent: true, opacity: 0.7, emissive: 0x5ea7cf, emissiveIntensity: 0.3, side: THREE.DoubleSide })
);
waterfall.position.set(320, terrainHeight(320, riverPathFn(320)) + 35, riverPathFn(320));
scene.add(waterfall);

const treeTrunkGeo = new THREE.CylinderGeometry(0.8, 1.2, 10, 8);
const treeLeafGeo = new THREE.SphereGeometry(4.5, 12, 10);
const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6a472d, roughness: 0.95 });
const leafMats = [0xde6a2c, 0xc84727, 0xf4be4f, 0x3f6d45, 0xb89b45].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }));

const trees = new THREE.Group();
for (let i = 0; i < 1800; i += 1) {
  const x = (Math.random() - 0.5) * (worldSize - 120);
  const z = (Math.random() - 0.5) * (worldSize - 120);
  if (Math.abs(z - riverPathFn(x)) < 16) continue;
  const y = terrainHeight(x, z);

  const trunk = new THREE.Mesh(treeTrunkGeo, trunkMat);
  trunk.position.set(x, y + 5, z);
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  trees.add(trunk);

  const crown = new THREE.Mesh(treeLeafGeo, leafMats[Math.floor(Math.random() * leafMats.length)]);
  crown.position.set(x, y + 12, z);
  crown.scale.setScalar(0.8 + Math.random() * 0.8);
  crown.castShadow = true;
  trees.add(crown);
}
scene.add(trees);

const townGroup = new THREE.Group();
const houseStyles = [0xc58f6d, 0x8ca0b5, 0xd8c89d];
const roofStyles = [0x894938, 0x586274, 0x6f8a4f];
const town = { x: -200, z: -160, wall: 0, roof: 0, decor: 0 };
for (let i = 0; i < 6; i += 1) {
  const hx = town.x + (i % 3) * 34 - 34;
  const hz = town.z + Math.floor(i / 3) * 34 - 17;
  const hy = terrainHeight(hx, hz);
  const home = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(14, 9, 12), new THREE.MeshStandardMaterial({ color: 0xb58b62 }));
  const roof = new THREE.Mesh(new THREE.ConeGeometry(10, 6, 4), new THREE.MeshStandardMaterial({ color: 0x7f4733 }));
  roof.rotation.y = Math.PI * 0.25;
  body.position.y = 4.5;
  roof.position.y = 12;
  home.add(body, roof);
  home.position.set(hx, hy, hz);
  home.castShadow = true;
  home.children.forEach((c) => {
    c.castShadow = true;
    c.receiveShadow = true;
  });
  townGroup.add(home);
}
scene.add(townGroup);

const npc = new THREE.Mesh(new THREE.CapsuleGeometry(1.2, 3.4, 4, 8), new THREE.MeshStandardMaterial({ color: 0x405f96 }));
npc.position.set(town.x + 10, terrainHeight(town.x + 10, town.z + 10) + 2.7, town.z + 10);
npc.castShadow = true;
scene.add(npc);

const player = {
  pos: new THREE.Vector3(-260, terrainHeight(-260, -240) + 3.2, -240),
  yaw: 0.25,
  speed: 24,
};

const petData = [
  { kind: "Dog", color: 0x8f6a43 },
  { kind: "Fox", color: 0xcd7330 },
  { kind: "Cat", color: 0x8f92a4 },
];
let activePet = 0;
const companions = petData.map((p, idx) => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 12), new THREE.MeshStandardMaterial({ color: p.color }));
  m.castShadow = true;
  m.position.copy(player.pos).add(new THREE.Vector3(-2 - idx * 1.4, 0, 1.8 + idx * 1.2));
  scene.add(m);
  return m;
});

const keys = new Set();
let dragging = false;
let lastX = 0;
let buildMode = false;
let info = "WebGL mode loaded. This is the highest fidelity version possible in-browser without a native game engine build.";
let infoTimer = 6;

window.addEventListener("keydown", (e) => keys.add(e.key.toLowerCase()));
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
canvas.addEventListener("mousedown", (e) => { dragging = true; lastX = e.clientX; });
window.addEventListener("mouseup", () => { dragging = false; });
window.addEventListener("mousemove", (e) => {
  if (!dragging) return;
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
    info = "Ivy: This is now a real WebGL 3D world. Native Unreal quality would require a full engine project build.";
    infoTimer = 7;
  }
}

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

  companions.forEach((pet, idx) => {
    const target = player.pos.clone().add(new THREE.Vector3(Math.cos(player.yaw + Math.PI + idx * 0.8) * (4 + idx * 1.1), 0, Math.sin(player.yaw + Math.PI + idx * 0.8) * (4 + idx * 1.1)));
    pet.position.lerp(target.setY(groundAt(target.x, target.z) - 1.6 + Math.sin(t * 4 + idx) * 0.05), dt * 3.4);
    pet.scale.setScalar(idx === activePet ? 1.18 : 1.0);
  });

  npc.position.y = groundAt(npc.position.x, npc.position.z) - 0.5;
  waterfall.material.opacity = 0.58 + Math.sin(t * 5) * 0.12;

  const camTarget = player.pos.clone().add(new THREE.Vector3(0, 2.3, 0));
  const back = forward.clone().multiplyScalar(-9.5);
  const camPos = camTarget.clone().add(back).add(new THREE.Vector3(0, 5.7, 0));
  camPos.y = Math.max(camPos.y, groundAt(camPos.x, camPos.z) + 1.2);

  camera.position.lerp(camPos, dt * 7);
  camera.lookAt(camTarget);

  const fNow = keys.has("f");
  if (fNow && !prevF) tryInteract();
  prevF = fNow;

  const pNow = keys.has("p");
  if (pNow && !prevP) {
    activePet = (activePet + 1) % companions.length;
    info = `Switched companion to ${petData[activePet].kind}.`;
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
    prev1 = k1; prev2 = k2; prev3 = k3;
    updateTownStyles();
  } else {
    prev1 = prev2 = prev3 = false;
  }

  if (infoTimer > 0) infoTimer -= dt;
  const biome = (() => {
    const n = Math.sin(player.pos.x * 0.0025) + Math.cos(player.pos.z * 0.002);
    if (Math.abs(player.pos.z - riverPathFn(player.pos.x)) < 30) return "Lakeside";
    if (n > 1.0) return "Highlands";
    if (n > 0.2) return "Autumn Forest";
    if (n > -0.5) return "Pine Woods";
    return "Sunlit Meadow";
  })();

  statusEl.textContent = `Mode: High Fidelity WebGL • FPS target: 60 • Biome: ${biome} • Companion: ${petData[activePet].kind} • Town: Maple Hollow${buildMode ? " (Build Mode)" : ""}`;
  dialogueEl.textContent = infoTimer > 0
    ? info
    : "Unreal-level visuals require building in Unreal Engine itself (native app/web export), but this is a major browser graphics jump with real-time lighting + shadows.";

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

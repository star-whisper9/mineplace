import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createWorld } from './world';
import { createCrop, updateCrop, type Crop } from './crops';
import { createFishPool, updateFishPool } from './fish';
import { createParticleSystem, updateParticles } from './particles';
import { updateAnimatedTextures } from './textures';
import { createItemDropSystem, updateItemDrops } from './drops';
import { setupInteraction } from './interaction';

// --- Renderer ---
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// --- Scene ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xc8dbe0);

// --- Camera (fixed isometric-ish angle) ---
const camera = new THREE.PerspectiveCamera(
  35,
  window.innerWidth / window.innerHeight,
  0.1,
  100,
);
// Position: looking from front-left, water blocks closest
camera.position.set(-3, 5.3, 6);
camera.lookAt(0, 0, 0);

// --- OrbitControls ---
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(1, 0.8, 0.5);
controls.enablePan = false;
controls.enableDamping = true;
controls.dampingFactor = 0.1;
controls.minDistance = 4;
controls.maxDistance = 12;
controls.minPolarAngle = 0.3;
controls.maxPolarAngle = Math.PI / 2.2;
controls.update();

// --- Lighting ---
const ambientLight = new THREE.AmbientLight(0xffffff, 2.2);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 4.6);
dirLight.position.set(0, 3, 0);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(1024, 1024);
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 20;
dirLight.shadow.camera.left = -5;
dirLight.shadow.camera.right = 5;
dirLight.shadow.camera.top = 5;
dirLight.shadow.camera.bottom = -5;
scene.add(dirLight);

// --- World ---
const world = createWorld();
scene.add(world);

// --- Crops ---
// Farmland positions: (1,z=0), (2,z=0), (2,z=1)
const crops: Crop[] = [
  createCrop('wheat', 1, 0),
  createCrop('carrots', 2, 0),
  createCrop('sweetBerry', 2, 1, 'grass'),
];
for (const crop of crops) {
  world.add(crop.group);
}

// --- Fish ---
const fishPool = createFishPool();
world.add(fishPool.container);

// --- Particles ---
const particles = createParticleSystem();
world.add(particles.group);

// --- Item drops ---
const drops = createItemDropSystem();
world.add(drops.group);

// --- Interaction (click crops + fish + drops) ---
setupInteraction(renderer, camera, crops, fishPool, particles, drops);

// --- Resize handler ---
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Main loop ---
const clock = new THREE.Clock();

function animate() {
  const delta = clock.getDelta();

  controls.update();

  // Update crop growth
  for (const crop of crops) {
    updateCrop(crop, delta);
  }

  // Update fish pool (spawn cycle + swimming)
  updateFishPool(fishPool, delta);

  // Update particles (includes auto-bubbles)
  updateParticles(particles, delta, camera);

  // Update dropped items (bob + fly-to-cursor)
  updateItemDrops(drops, delta, camera);

  // Animate water textures
  updateAnimatedTextures(delta);

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();

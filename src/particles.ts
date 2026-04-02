import * as THREE from 'three';

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const PX = 1 / 16;

// Water area for auto-bubbles
const WATER_X: [number, number] = [-0.3, 1.3];
const WATER_Z: [number, number] = [0.6, 1.4];
const WATER_Y_MIN = 0.55;
const WATER_SURFACE = 1.35;

/* ------------------------------------------------------------------ */
/*  Particle atlas                                                    */
/* ------------------------------------------------------------------ */

const _loader = new THREE.TextureLoader();
const _atlas = _loader.load('/textures/particle/particles.png');
_atlas.magFilter = THREE.NearestFilter;
_atlas.minFilter = THREE.NearestFilter;
_atlas.colorSpace = THREE.SRGBColorSpace;

// Atlas = 128×128 px, 8×8 cells → 16×16 grid
const CELLS = 16;

/** Create a PlaneGeometry with UV mapped to a specific cell in the atlas. */
function cellGeo(cx: number, cy: number): THREE.PlaneGeometry {
  const geo = new THREE.PlaneGeometry(1, 1);
  const uv = geo.attributes.uv as THREE.Float32BufferAttribute;
  const u0 = cx / CELLS;
  const u1 = (cx + 1) / CELLS;
  const v0 = 1 - (cy + 1) / CELLS;
  const v1 = 1 - cy / CELLS;
  uv.setXY(0, u0, v1);
  uv.setXY(1, u1, v1);
  uv.setXY(2, u0, v0);
  uv.setXY(3, u1, v0);
  return geo;
}

// Pre-built geometries per particle type
const _bonemealGeo = cellGeo(2, 5); // happy_villager (green star)
const _bubbleGeo = cellGeo(1, 1); // bubble (blue)
const _breakGeos = [cellGeo(2, 0), cellGeo(3, 0), cellGeo(4, 0), cellGeo(5, 0)]; // generic white (various sizes)

function atlasMat(opts?: {
  color?: number;
  opacity?: number;
}): THREE.MeshBasicMaterial {
  const mat = new THREE.MeshBasicMaterial({
    map: _atlas,
    transparent: true,
    alphaTest: 0.01,
    side: THREE.DoubleSide,
    depthWrite: false,
    opacity: opts?.opacity ?? 1,
  });
  if (opts?.color != null) mat.color.set(opts.color);
  return mat;
}

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

type Particle = {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  gravity: number;
  fadeOut: boolean;
  billboard: boolean;
  ceiling?: number | undefined;
};

export type ParticleSystem = {
  group: THREE.Group;
  particles: Particle[];
  bubbleTimer: number;
};

/* ------------------------------------------------------------------ */
/*  Core                                                              */
/* ------------------------------------------------------------------ */

export function createParticleSystem(): ParticleSystem {
  return {
    group: new THREE.Group(),
    particles: [],
    bubbleTimer: THREE.MathUtils.randFloat(0.5, 2),
  };
}

function spawn(
  sys: ParticleSystem,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  scale: number,
  pos: THREE.Vector3,
  vel: THREE.Vector3,
  life: number,
  gravity: number,
  fadeOut: boolean,
  billboard: boolean,
  ceiling?: number,
): void {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.scale.setScalar(scale);
  mesh.position.copy(pos);
  if (!billboard) {
    mesh.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI,
    );
  }
  sys.group.add(mesh);
  sys.particles.push({
    mesh,
    velocity: vel.clone(),
    life,
    maxLife: life,
    gravity,
    fadeOut,
    billboard,
    ceiling,
  });
}

export function updateParticles(
  sys: ParticleSystem,
  dt: number,
  camera: THREE.Camera,
): void {
  // --- Auto-bubbles ---
  sys.bubbleTimer -= dt;
  if (sys.bubbleTimer <= 0) {
    sys.bubbleTimer = THREE.MathUtils.randFloat(1.5, 4);
    const bPos = new THREE.Vector3(
      THREE.MathUtils.randFloat(...WATER_X),
      THREE.MathUtils.randFloat(WATER_Y_MIN, WATER_SURFACE - 0.2),
      THREE.MathUtils.randFloat(...WATER_Z),
    );
    emitBubble(sys, bPos);
  }

  // --- Update all particles ---
  for (let i = sys.particles.length - 1; i >= 0; i--) {
    const p = sys.particles[i]!;
    p.life -= dt;

    if (p.life <= 0 || (p.ceiling != null && p.mesh.position.y >= p.ceiling)) {
      sys.group.remove(p.mesh);
      (p.mesh.material as THREE.Material).dispose();
      sys.particles.splice(i, 1);
      continue;
    }

    // Physics
    p.velocity.y -= p.gravity * dt;
    p.mesh.position.addScaledVector(p.velocity, dt);

    if (p.billboard) {
      p.mesh.quaternion.copy(camera.quaternion);
    } else {
      p.mesh.rotation.x += dt * 2;
      p.mesh.rotation.z += dt * 1.5;
    }

    // Fade out
    if (p.fadeOut) {
      const ratio = p.life / p.maxLife;
      const mat = p.mesh.material as THREE.MeshBasicMaterial;
      if ('opacity' in mat) mat.opacity = ratio;
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Emitters                                                          */
/* ------------------------------------------------------------------ */

/** Green sparkle burst (bone meal / happy_villager). */
export function emitBonemeal(sys: ParticleSystem, pos: THREE.Vector3): void {
  for (let i = 0; i < 15; i++) {
    const size = PX * THREE.MathUtils.randFloat(1, 2.5);
    const vel = new THREE.Vector3(
      THREE.MathUtils.randFloatSpread(1.5),
      THREE.MathUtils.randFloat(0.5, 2),
      THREE.MathUtils.randFloatSpread(1.5),
    );
    spawn(
      sys,
      _bonemealGeo,
      atlasMat(),
      size,
      pos,
      vel,
      THREE.MathUtils.randFloat(0.4, 0.8),
      3,
      true,
      false,
    );
  }
}

/** Tiny colored particles (crop break / harvest). Uses generic white tinted. */
export function emitBreak(
  sys: ParticleSystem,
  pos: THREE.Vector3,
  color: number,
): void {
  for (let i = 0; i < 8; i++) {
    const size = PX * THREE.MathUtils.randFloat(0.5, 1.2);
    const geo = _breakGeos[Math.floor(Math.random() * _breakGeos.length)]!;
    const vel = new THREE.Vector3(
      THREE.MathUtils.randFloatSpread(2),
      THREE.MathUtils.randFloat(1, 3),
      THREE.MathUtils.randFloatSpread(2),
    );
    spawn(
      sys,
      geo,
      atlasMat({ color }),
      size,
      pos,
      vel,
      THREE.MathUtils.randFloat(0.5, 1),
      6,
      true,
      false,
    );
  }
}

/** Single bubble rising in water (billboard). */
export function emitBubble(sys: ParticleSystem, pos: THREE.Vector3): void {
  const size = PX * THREE.MathUtils.randFloat(0.4, 1);
  const vel = new THREE.Vector3(
    THREE.MathUtils.randFloatSpread(0.08),
    THREE.MathUtils.randFloat(0.15, 0.35),
    THREE.MathUtils.randFloatSpread(0.08),
  );
  spawn(
    sys,
    _bubbleGeo,
    atlasMat({ opacity: 0.7 }),
    size,
    pos,
    vel,
    5,
    0,
    true,
    true,
    WATER_SURFACE,
  );
}

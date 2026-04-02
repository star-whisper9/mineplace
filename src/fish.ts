import * as THREE from 'three';

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const PX = 1 / 16;
const SCALE = 0.75;
const S = PX * SCALE; // pixel → block-unit conversion

// Water swimming bounds (from merged water in world.ts)
const BOUNDS = {
  minX: -0.2,
  maxX: 1.2,
  minY: 0.65,
  maxY: 1.15,
  minZ: 0.65,
  maxZ: 1.35,
};

const SWIM_TIME: [number, number] = [8, 15];
const EMPTY_TIME: [number, number] = [3, 6];
const SWIM_SPEED = 0.1;

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

type FishType = 'cod' | 'salmon' | 'pufferfish';

type CubeDef = {
  origin: [number, number, number];
  size: [number, number, number];
  uv: [number, number];
};

type FishDef = {
  texture: string;
  texW: number;
  texH: number;
  cubes: CubeDef[];
  tailColor: number;
  tailH: number;
  tailL: number;
};

type FishInstance = {
  group: THREE.Group;
  tail: THREE.Mesh;
  target: THREE.Vector3;
  targetTimer: number;
  targetInterval: number;
  phase: number;
  speedMultiplier: number;
};

export type FishPool = {
  container: THREE.Group;
  instances: Map<FishType, FishInstance>;
  active: FishType | null;
  timer: number;
  duration: number;
  state: 'swimming' | 'empty';
};

/* ------------------------------------------------------------------ */
/*  Fish definitions (from .geo.json models)                          */
/* ------------------------------------------------------------------ */

const DEFS: Record<FishType, FishDef> = {
  cod: {
    texture: 'cod',
    texW: 32,
    texH: 32,
    cubes: [
      { origin: [-1, 0, 1], size: [2, 4, 7], uv: [0, 0] },
      { origin: [-1, 0, -2], size: [2, 4, 3], uv: [11, 0] },
    ],
    tailColor: 0xa08838,
    tailH: 3.5,
    tailL: 3,
  },
  salmon: {
    texture: 'salmon',
    texW: 32,
    texH: 32,
    cubes: [
      { origin: [-1.5, 3.5, -4], size: [3, 5, 8], uv: [0, 0] },
      { origin: [-1.5, 3.5, 4], size: [3, 5, 8], uv: [0, 13] },
      { origin: [-1, 4.5, -7], size: [2, 4, 3], uv: [22, 0] },
    ],
    tailColor: 0x802828,
    tailH: 4,
    tailL: 3,
  },
  pufferfish: {
    texture: 'pufferfish',
    texW: 32,
    texH: 32,
    cubes: [{ origin: [-1.5, 0, -1.5], size: [3, 2, 3], uv: [0, 27] }],
    tailColor: 0xd0a030,
    tailH: 1.5,
    tailL: 1.5,
  },
};

/* ------------------------------------------------------------------ */
/*  Bedrock box UV mapping                                            */
/* ------------------------------------------------------------------ */

function applyBedrockBoxUV(
  geo: THREE.BoxGeometry,
  uv: [number, number],
  size: [number, number, number],
  tw: number,
  th: number,
): void {
  const [w, h, d] = size;
  const [u0, v0] = uv;

  // Bedrock cross-style UV layout (pixel coords)
  const regions = [
    /* 0 +X right */ { px: u0, py: v0 + d, pw: d, ph: h },
    /* 1 -X left  */ { px: u0 + d + w, py: v0 + d, pw: d, ph: h },
    /* 2 +Y top   */ { px: u0 + d, py: v0, pw: w, ph: d },
    /* 3 -Y bot   */ { px: u0 + d + w, py: v0, pw: w, ph: d },
    /* 4 +Z back  */ { px: u0 + 2 * d + w, py: v0 + d, pw: w, ph: h },
    /* 5 -Z front */ { px: u0 + d, py: v0 + d, pw: w, ph: h },
  ];

  const attr = geo.getAttribute('uv') as THREE.BufferAttribute;
  for (let f = 0; f < 6; f++) {
    const r = regions[f]!;
    const base = f * 4;
    const l = r.px / tw;
    const rt = (r.px + r.pw) / tw;
    const t = 1 - r.py / th;
    const b = 1 - (r.py + r.ph) / th;
    // Three.js BoxGeo per-face vertex order: TL(0,1) TR(1,1) BL(0,0) BR(1,0)
    attr.setXY(base + 0, l, t);
    attr.setXY(base + 1, rt, t);
    attr.setXY(base + 2, l, b);
    attr.setXY(base + 3, rt, b);
  }
  attr.needsUpdate = true;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function randomTarget(): THREE.Vector3 {
  return new THREE.Vector3(
    THREE.MathUtils.randFloat(BOUNDS.minX, BOUNDS.maxX),
    THREE.MathUtils.randFloat(BOUNDS.minY, BOUNDS.maxY),
    THREE.MathUtils.randFloat(BOUNDS.minZ, BOUNDS.maxZ),
  );
}

function randRange([lo, hi]: [number, number]): number {
  return THREE.MathUtils.randFloat(lo, hi);
}

/* ------------------------------------------------------------------ */
/*  Build a single fish model                                         */
/* ------------------------------------------------------------------ */

const loader = new THREE.TextureLoader();
const BASE_PATH = `${import.meta.env.BASE_URL}textures/entity/fish`;

function buildFish(type: FishType): FishInstance {
  const def = DEFS[type];
  const group = new THREE.Group();

  // Texture (pixel-art filtering)
  const tex = loader.load(`${BASE_PATH}/${def.texture}.png`);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshLambertMaterial({ map: tex });

  // Body cubes with Bedrock UV
  const bodyGroup = new THREE.Group();
  for (const c of def.cubes) {
    const geo = new THREE.BoxGeometry(
      c.size[0] * S,
      c.size[1] * S,
      c.size[2] * S,
    );
    applyBedrockBoxUV(geo, c.uv, c.size, def.texW, def.texH);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(
      (c.origin[0] + c.size[0] / 2) * S,
      (c.origin[1] + c.size[1] / 2) * S,
      (c.origin[2] + c.size[2] / 2) * S,
    );
    bodyGroup.add(mesh);
  }

  // Center the body at origin
  const box = new THREE.Box3().setFromObject(bodyGroup);
  const center = box.getCenter(new THREE.Vector3());
  for (const child of bodyGroup.children) {
    (child as THREE.Mesh).position.sub(center);
  }
  group.add(bodyGroup);

  // Tail fin (colored plane, pivots at attachment edge)
  const tH = def.tailH * S;
  const tL = def.tailL * S;
  const tailGeo = new THREE.PlaneGeometry(tL, tH);
  tailGeo.rotateY(Math.PI / 2); // XY → YZ
  tailGeo.translate(0, 0, tL / 2); // pivot at front edge, extends +Z
  const tail = new THREE.Mesh(
    tailGeo,
    new THREE.MeshLambertMaterial({
      color: def.tailColor,
      side: THREE.DoubleSide,
    }),
  );
  // Place at back of body (+Z = tail end in MC model, head at -Z)
  const halfZ = box.getSize(new THREE.Vector3()).z / 2;
  tail.position.set(0, 0, halfZ);
  group.add(tail);

  group.visible = false;
  group.position.copy(randomTarget());
  group.rotation.y = Math.random() * Math.PI * 2;

  return {
    group,
    tail,
    target: randomTarget(),
    targetTimer: 0,
    targetInterval: randRange([2, 4]),
    phase: Math.random() * Math.PI * 2,
    speedMultiplier: 1,
  };
}

/* ------------------------------------------------------------------ */
/*  Pool — spawn / despawn cycle                                      */
/* ------------------------------------------------------------------ */

const TYPES: FishType[] = ['cod', 'salmon', 'pufferfish'];

function pickRandom(): FishType {
  return TYPES[Math.floor(Math.random() * TYPES.length)]!;
}

export function createFishPool(): FishPool {
  const container = new THREE.Group();
  const instances = new Map<FishType, FishInstance>();

  for (const type of TYPES) {
    const inst = buildFish(type);
    instances.set(type, inst);
    container.add(inst.group);
  }

  // Start with one fish visible
  const first = pickRandom();
  instances.get(first)!.group.visible = true;

  return {
    container,
    instances,
    active: first,
    timer: 0,
    duration: randRange(SWIM_TIME),
    state: 'swimming',
  };
}

const _dir = new THREE.Vector3();

export function updateFishPool(pool: FishPool, dt: number): void {
  pool.timer += dt;

  // State transitions
  if (pool.timer >= pool.duration) {
    pool.timer = 0;
    if (pool.state === 'swimming') {
      // Despawn current fish
      if (pool.active) {
        pool.instances.get(pool.active)!.group.visible = false;
      }
      pool.active = null;
      pool.state = 'empty';
      pool.duration = randRange(EMPTY_TIME);
    } else {
      // Spawn a new random fish
      const type = pickRandom();
      const inst = pool.instances.get(type)!;
      inst.group.position.copy(randomTarget());
      inst.group.rotation.y = Math.random() * Math.PI * 2;
      inst.target.copy(randomTarget());
      inst.targetTimer = 0;
      inst.targetInterval = randRange([2, 4]);
      inst.group.visible = true;
      pool.active = type;
      pool.state = 'swimming';
      pool.duration = randRange(SWIM_TIME);
    }
  }

  // Animate active fish
  if (!pool.active) return;
  const fish = pool.instances.get(pool.active)!;
  fish.phase += dt;
  fish.targetTimer += dt;

  if (fish.targetTimer >= fish.targetInterval) {
    fish.target.copy(randomTarget());
    fish.targetTimer = 0;
    fish.targetInterval = randRange([2, 4]);
  }

  const pos = fish.group.position;
  _dir.subVectors(fish.target, pos);
  const dist = _dir.length();

  if (dist > 0.02) {
    _dir.normalize();
    const speed = SWIM_SPEED * fish.speedMultiplier;
    fish.speedMultiplier = THREE.MathUtils.lerp(
      fish.speedMultiplier,
      1,
      dt * 2,
    );
    pos.addScaledVector(_dir, Math.min(speed * dt, dist));

    // Face movement direction (+π because MC model faces -Z)
    const desired = Math.atan2(_dir.x, _dir.z) + Math.PI;
    let diff = desired - fish.group.rotation.y;
    diff = ((diff + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    fish.group.rotation.y += diff * Math.min(1, dt * 4);

    // Subtle pitch when swimming up/down
    fish.group.rotation.x = THREE.MathUtils.lerp(
      fish.group.rotation.x,
      -_dir.y * 0.4,
      dt * 3,
    );
  }

  // Clamp to water bounds
  pos.x = THREE.MathUtils.clamp(pos.x, BOUNDS.minX, BOUNDS.maxX);
  pos.y = THREE.MathUtils.clamp(pos.y, BOUNDS.minY, BOUNDS.maxY);
  pos.z = THREE.MathUtils.clamp(pos.z, BOUNDS.minZ, BOUNDS.maxZ);

  // Tail swish
  fish.tail.rotation.y = Math.sin(fish.phase * 8) * 0.35;
}

/** Make the active fish dart away (poked by player). */
export function pokeFish(pool: FishPool): void {
  if (!pool.active) return;
  const fish = pool.instances.get(pool.active)!;
  const pos = fish.group.position;
  // Flee to opposite side of the pool
  fish.target.set(
    pos.x > 0.5 ? BOUNDS.minX : BOUNDS.maxX,
    THREE.MathUtils.randFloat(BOUNDS.minY, BOUNDS.maxY),
    pos.z > 1.0 ? BOUNDS.minZ : BOUNDS.maxZ,
  );
  fish.targetTimer = 0;
  fish.targetInterval = 3;
  fish.speedMultiplier = 5;
}

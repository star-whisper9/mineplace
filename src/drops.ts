import * as THREE from 'three';

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const ITEM_SIZE = 0.32; // world-unit size of the item sprite
const BOB_SPEED = 2.5; // Hz
const BOB_AMP = 0.04; // blocks
const COLLECT_DELAY = 3; // seconds before flying to cursor
const FLY_SPEED = 8; // blocks/s

type CropType = 'wheat' | 'carrots' | 'sweetBerry';

const ITEM_TEXTURES: Record<CropType, string> = {
  wheat: '/textures/items/wheat.png',
  carrots: '/textures/items/carrot.png',
  sweetBerry: '/textures/items/sweet_berries.png',
};

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

type DroppedItem = {
  mesh: THREE.Mesh;
  baseY: number;
  phase: number;
  age: number;
  state: 'bobbing' | 'flying';
  onCollect?: (() => void) | undefined;
};

export type ItemDropSystem = {
  group: THREE.Group;
  items: DroppedItem[];
};

/* ------------------------------------------------------------------ */
/*  Core                                                              */
/* ------------------------------------------------------------------ */

const loader = new THREE.TextureLoader();

export function createItemDropSystem(): ItemDropSystem {
  return {
    group: new THREE.Group(),
    items: [],
  };
}

export function spawnDrop(
  sys: ItemDropSystem,
  cropType: CropType,
  cropGroupPos: THREE.Vector3,
  onCollect?: () => void,
): void {
  const tex = loader.load(ITEM_TEXTURES[cropType]);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;

  const geo = new THREE.PlaneGeometry(ITEM_SIZE, ITEM_SIZE);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    alphaTest: 0.1,
    side: THREE.DoubleSide,
    depthWrite: true,
  });

  const mesh = new THREE.Mesh(geo, mat);

  // Land on the block surface
  // Crop group Y = blockTop + 0.5, so blockTop = cropGroupY - 0.5
  const blockTop = cropGroupPos.y - 0.5;
  const baseY = blockTop + ITEM_SIZE / 2 + 0.01;
  mesh.position.set(cropGroupPos.x, baseY, cropGroupPos.z);

  sys.group.add(mesh);
  sys.items.push({
    mesh,
    baseY,
    phase: Math.random() * Math.PI * 2,
    age: 0,
    state: 'bobbing',
    onCollect,
  });
}

const STOP_DIST = 1.2; // stop this far from camera (showcase distance)
const SHOWCASE_SCALE = 1; // scale up as it approaches

const _dir = new THREE.Vector3();

export function updateItemDrops(
  sys: ItemDropSystem,
  dt: number,
  camera: THREE.Camera,
): void {
  for (let i = sys.items.length - 1; i >= 0; i--) {
    const item = sys.items[i]!;
    item.age += dt;
    item.phase += dt;

    // Billboard: face the camera
    item.mesh.quaternion.copy(camera.quaternion);

    if (item.state === 'bobbing') {
      // Bob up and down on surface
      item.mesh.position.y =
        item.baseY + Math.sin(item.phase * BOB_SPEED) * BOB_AMP;

      // Transition to flying after delay
      if (item.age >= COLLECT_DELAY) {
        item.state = 'flying';
      }
    } else {
      // Fly toward camera, stop just in front
      _dir.subVectors(camera.position, item.mesh.position);
      const dist = _dir.length();

      if (dist <= STOP_DIST) {
        // wait 1s before removing
        if (item.age >= COLLECT_DELAY + 1) {
          removeDrop(sys, i);
        }
        continue;
      }

      _dir.normalize();
      const step = Math.min(FLY_SPEED * dt, dist - STOP_DIST);
      item.mesh.position.addScaledVector(_dir, step);

      // Scale up as it approaches for showcase effect
      const t = 1 - (dist - STOP_DIST) / (dist + STOP_DIST);
      const s = 1 + (SHOWCASE_SCALE - 1) * t;
      item.mesh.scale.setScalar(s);

      // Safety: remove after flying too long
      if (item.age > COLLECT_DELAY + 3) {
        removeDrop(sys, i);
        continue;
      }
    }
  }
}

/** Remove a drop by index and trigger its onCollect callback. */
function removeDrop(sys: ItemDropSystem, index: number): void {
  const item = sys.items[index]!;
  sys.group.remove(item.mesh);
  (item.mesh.material as THREE.Material).dispose();
  item.mesh.geometry.dispose();
  sys.items.splice(index, 1);
  item.onCollect?.();
}

/** Try to "pick up" a drop via raycaster hit. Returns true if a drop was removed. */
export function pickUpDrop(
  sys: ItemDropSystem,
  raycaster: THREE.Raycaster,
): boolean {
  const meshes = sys.items.map((i) => i.mesh);
  const hits = raycaster.intersectObjects(meshes);
  if (hits.length === 0) return false;
  const hitMesh = hits[0]!.object;
  const idx = sys.items.findIndex((i) => i.mesh === hitMesh);
  if (idx >= 0) {
    removeDrop(sys, idx);
    return true;
  }
  return false;
}

import * as THREE from 'three';
import {
  type Crop,
  isMature,
  bonemealCrop,
  harvestCrop,
  replantCrop,
} from './crops';
import { type FishPool, pokeFish } from './fish';
import { type ParticleSystem, emitBonemeal } from './particles';
import { type ItemDropSystem, spawnDrop, pickUpDrop } from './drops';

export function setupInteraction(
  renderer: THREE.WebGLRenderer,
  camera: THREE.Camera,
  crops: Crop[],
  fishPool: FishPool,
  particles: ParticleSystem,
  drops: ItemDropSystem,
): void {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  // Map clickable mesh → crop
  const cropMap = new Map<THREE.Object3D, Crop>();
  for (const crop of crops) {
    cropMap.set(crop.plane1, crop);
    cropMap.set(crop.plane2, crop);
  }

  const _worldPos = new THREE.Vector3();

  function handle(e: PointerEvent): void {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    // --- Dropped items (pick up first) ---
    if (pickUpDrop(drops, raycaster)) return;

    // --- Crops ---
    const cropTargets = Array.from(cropMap.keys());
    const cropHits = raycaster.intersectObjects(cropTargets);
    if (cropHits.length > 0) {
      const crop = cropMap.get(cropHits[0]!.object);
      if (crop) {
        crop.group.getWorldPosition(_worldPos);
        if (isMature(crop)) {
          harvestCrop(crop);
          spawnDrop(drops, crop.type, _worldPos, () => replantCrop(crop));
        } else {
          bonemealCrop(crop);
          emitBonemeal(particles, _worldPos);
        }
        return;
      }
    }

    // --- Active fish ---
    if (fishPool.active) {
      const inst = fishPool.instances.get(fishPool.active);
      if (inst?.group.visible) {
        const meshes: THREE.Object3D[] = [];
        inst.group.traverse((obj) => {
          if (obj instanceof THREE.Mesh) meshes.push(obj);
        });
        const fishHits = raycaster.intersectObjects(meshes);
        if (fishHits.length > 0) {
          pokeFish(fishPool);
        }
      }
    }
  }

  renderer.domElement.addEventListener('pointerup', handle);
}

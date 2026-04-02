import * as THREE from 'three';
import { textures } from './textures';

// --- Crop type definitions ---

type CropType = 'wheat' | 'carrots' | 'sweetBerry';

type CropConfig = {
  /** Max growth stage (inclusive) */
  maxStage: number;
  /** Get texture for a given stage */
  getTexture: (stage: number) => THREE.Texture;
  /** Seconds per growth stage */
  growthInterval: number;
};

const CROP_CONFIGS: Record<CropType, CropConfig> = {
  wheat: {
    maxStage: 7,
    getTexture: (stage) => textures.wheat(stage),
    growthInterval: 3,
  },
  carrots: {
    maxStage: 3,
    getTexture: (stage) => textures.carrots(stage),
    growthInterval: 4,
  },
  sweetBerry: {
    maxStage: 3,
    getTexture: (stage) => textures.sweetBerry(stage),
    growthInterval: 3.5,
  },
};

// --- Crop instance ---

export type Crop = {
  type: CropType;
  stage: number;
  timer: number;
  group: THREE.Group;
  plane1: THREE.Mesh;
  plane2: THREE.Mesh;
  material: THREE.MeshLambertMaterial;
  /** Grid position of the farmland this crop is on */
  gridX: number;
  gridZ: number;
};

/**
 * Create the crossed-planes mesh for a crop.
 * Classic MC crop: two PlaneGeometry(1,1) intersecting at 90°.
 */
function createCropMesh(
  cropType: CropType,
  stage: number,
): {
  group: THREE.Group;
  plane1: THREE.Mesh;
  plane2: THREE.Mesh;
  material: THREE.MeshLambertMaterial;
} {
  const config = CROP_CONFIGS[cropType];
  const tex = config.getTexture(stage);

  const material = new THREE.MeshLambertMaterial({
    map: tex,
    alphaTest: 0.1,
    side: THREE.DoubleSide,
    transparent: false,
  });

  const geo = new THREE.PlaneGeometry(1, 1);

  // Plane 1: faces +z/-z
  const plane1 = new THREE.Mesh(geo, material);
  plane1.castShadow = true;
  plane1.receiveShadow = true;

  // Plane 2: faces +x/-x (rotated 90° around Y)
  const plane2 = new THREE.Mesh(geo, material);
  plane2.rotation.y = Math.PI / 2;
  plane2.castShadow = true;
  plane2.receiveShadow = true;

  const group = new THREE.Group();
  group.add(plane1);
  group.add(plane2);

  return { group, plane1, plane2, material };
}

/**
 * Create a crop on a farmland block at the given grid position.
 * Farmland top is at y = gridY + 15/32 - 0.5 above its center... let me think:
 * Farmland center y = 1 - 1/32 = 0.96875
 * Farmland half-height = 15/32 = 0.46875
 * Farmland top surface = 0.96875 + 0.46875 = 1.4375
 * Crop center y = farmlandTop + 0.5 (half of 1-unit plane) = 1.9375
 */
export function createCrop(
  type: CropType,
  gridX: number,
  gridZ: number,
  onBlock: 'farmland' | 'grass' = 'farmland',
): Crop {
  const { group, plane1, plane2, material } = createCropMesh(type, 0);

  // Block top surface Y depends on block type
  // Farmland: center=1-1/32, halfH=15/32 → top=1.4375
  // Grass: center=1, halfH=0.5 → top=1.5
  const blockTop = onBlock === 'grass' ? 1.5 : 1 - 1 / 32 + 15 / 32;
  group.position.set(gridX, blockTop + 0.5, gridZ);

  return {
    type,
    stage: 0,
    timer: 0,
    group,
    plane1,
    plane2,
    material,
    gridX,
    gridZ,
  };
}

/**
 * Advance crop growth by deltaTime seconds.
 * Returns true if the crop grew a stage.
 */
export function updateCrop(crop: Crop, deltaTime: number): boolean {
  const config = CROP_CONFIGS[crop.type];

  // Skip hidden (harvested, awaiting replant) or fully grown
  if (!crop.group.visible) return false;
  if (crop.stage >= config.maxStage) return false;

  crop.timer += deltaTime;
  if (crop.timer >= config.growthInterval) {
    crop.timer -= config.growthInterval;
    crop.stage++;

    // Update texture
    const newTex = config.getTexture(crop.stage);
    crop.material.map = newTex;
    crop.material.needsUpdate = true;

    return true;
  }
  return false;
}

/**
 * Immediately grow crop to max stage (bone meal effect).
 */
export function bonemealCrop(crop: Crop): boolean {
  const config = CROP_CONFIGS[crop.type];
  if (crop.stage >= config.maxStage) return false;

  crop.stage++;
  crop.timer = 0;
  crop.material.map = config.getTexture(crop.stage);
  crop.material.needsUpdate = true;
  return true;
}

/**
 * Check if crop is fully grown.
 */
export function isMature(crop: Crop): boolean {
  return crop.stage >= CROP_CONFIGS[crop.type].maxStage;
}

/**
 * Hide crop after harvest (awaiting drop collection before replant).
 */
export function harvestCrop(crop: Crop): void {
  crop.group.visible = false;
  crop.plane1.visible = false;
  crop.plane2.visible = false;
}

/**
 * Replant crop: reset to stage 0 and make visible again.
 */
export function replantCrop(crop: Crop): void {
  const config = CROP_CONFIGS[crop.type];
  crop.stage = 0;
  crop.timer = 0;
  crop.material.map = config.getTexture(0);
  crop.material.needsUpdate = true;
  crop.group.visible = true;
  crop.plane1.visible = true;
  crop.plane2.visible = true;
}

/** Representative color for each crop type (used for break particles). */
export const CROP_BREAK_COLORS: Record<CropType, number> = {
  wheat: 0xd4a017,
  carrots: 0xe87b1c,
  sweetBerry: 0xc42020,
};

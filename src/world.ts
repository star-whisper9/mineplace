import * as THREE from 'three';
import { textures, registerWaterTexture } from './textures';

/**
 * Block types in the world grid.
 *
 * Layout (top-down, viewed from camera angle):
 *
 *   col:   0        1        2
 * row 0: [grass]  [farm]   [farm]
 * row 1: [water]  [water]  [farm]
 *
 * Y layers:
 *  - y=0: dirt foundation (all 6 cells)
 *  - y=1: surface blocks (grass / farmland / water)
 */

type BlockType = 'grass' | 'farmland' | 'water' | 'dirt';

type BlockDef = {
  type: BlockType;
  position: [x: number, y: number, z: number];
};

function createBlockMaterials(
  type: BlockType,
): THREE.Material | THREE.Material[] {
  switch (type) {
    case 'grass': {
      // grass_side_carried.png has biome color baked in
      const side = new THREE.MeshLambertMaterial({ map: textures.grassSide() });
      // grass_top.png is grayscale — tint with biome green (MC wiki default)
      const PLAINS_GREEN = 0x92bc58;
      return [
        side, // +x
        side, // -x
        new THREE.MeshLambertMaterial({
          map: textures.grassTop(),
          color: PLAINS_GREEN,
        }), // +y
        new THREE.MeshLambertMaterial({ map: textures.dirt() }), // -y
        side, // +z
        side, // -z
      ];
    }
    case 'farmland': {
      const dirtMat = new THREE.MeshLambertMaterial({ map: textures.dirt() });
      return [
        dirtMat, // +x
        dirtMat, // -x
        new THREE.MeshLambertMaterial({ map: textures.farmlandWet() }), // +y
        dirtMat, // -y
        dirtMat, // +z
        dirtMat, // -z
      ];
    }
    case 'water': {
      // Grey textures + biome water tint (MC wiki default)
      const WATER_BLUE = 0x1e5af5;
      const waterTop = new THREE.MeshLambertMaterial({
        map: textures.waterStillGrey(),
        color: WATER_BLUE,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
      });
      const waterSide = new THREE.MeshLambertMaterial({
        map: textures.waterFlowGrey(),
        color: WATER_BLUE,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
      });
      return [
        waterSide, // +x
        waterSide, // -x
        waterTop, // +y
        waterTop, // -y
        waterSide, // +z
        waterSide, // -z
      ];
    }
    case 'dirt':
      return new THREE.MeshLambertMaterial({ map: textures.dirt() });
  }
}

function createBlock(def: BlockDef): THREE.Mesh {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = createBlockMaterials(def.type);
  const mesh = new THREE.Mesh(geo, mat);

  if (def.type === 'water') {
    // Water is 14/16 height in MC, sitting flush with top of farmland
    mesh.scale.y = 14 / 16;
    mesh.position.set(
      def.position[0],
      def.position[1] - 1 / 16,
      def.position[2],
    );
  } else if (def.type === 'farmland') {
    // Farmland is 15/16 height (1 pixel shorter than a full block)
    mesh.scale.y = 15 / 16;
    mesh.position.set(
      def.position[0],
      def.position[1] - 1 / 32,
      def.position[2],
    );
  } else {
    mesh.position.set(...def.position);
  }

  mesh.castShadow = def.type !== 'water';
  mesh.receiveShadow = true;
  mesh.userData['blockType'] = def.type;
  return mesh;
}

function createMergedWater(
  x: number,
  y: number,
  z: number,
  width: number,
): THREE.Mesh {
  const h = 14 / 16;
  const geo = new THREE.BoxGeometry(width, h, 1);
  const WATER_BLUE = 0x1e5af5;

  const makeWaterMat = (
    isStill: boolean,
    repeatX = 1,
    animate = false,
  ): THREE.MeshLambertMaterial => {
    const tex = isStill ? textures.waterStillGrey() : textures.waterFlowGrey();
    // Clone texture for unique repeat settings
    const t = tex.clone();
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeatX, t.repeat.y);
    t.offset.set(t.offset.x, t.offset.y);
    t.needsUpdate = true;
    // Only register top face clones for animation
    if (animate) registerWaterTexture(t, isStill ? 'still' : 'flow');
    return new THREE.MeshLambertMaterial({
      map: t,
      color: WATER_BLUE,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
  };

  // ±x faces: 1-unit wide (flow texture)
  // ±z faces: width-units wide (flow texture, tiled)
  // ±y faces: still texture, tiled
  const materials = [
    makeWaterMat(false, 1), // +x (flow, static)
    makeWaterMat(false, 1), // -x (flow, static)
    makeWaterMat(true, width, true), // +y (still, animated)
    makeWaterMat(true, width), // -y (still, static)
    makeWaterMat(false, width), // +z (flow, static)
    makeWaterMat(false, width), // -z (flow, static)
  ];

  const mesh = new THREE.Mesh(geo, materials);
  // Center of merged block: offset by (width-1)/2 from first cell
  mesh.position.set(x + (width - 1) / 2, y - 1 / 16, z);
  mesh.receiveShadow = true;
  mesh.userData['blockType'] = 'water';
  return mesh;
}

export function createWorld(): THREE.Group {
  const group = new THREE.Group();

  // Surface layer definition (y=1)
  const surfaceLayout: [BlockType, BlockType, BlockType][] = [
    ['grass', 'farmland', 'farmland'], // row 0 (z=0)
    ['water', 'water', 'grass'], // row 1 (z=1) — sweet berry grows on grass
  ];

  // Build dirt foundation (y=0)
  // for (let z = 0; z < 2; z++) {
  //   for (let x = 0; x < 3; x++) {
  //     group.add(createBlock({ type: 'dirt', position: [x, 0, z] }));
  //   }
  // }

  // Build surface layer (y=1) — skip water, handle separately
  for (let z = 0; z < surfaceLayout.length; z++) {
    const row = surfaceLayout[z]!;
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== 'water') {
        group.add(createBlock({ type: row[x]!, position: [x, 1, z] }));
      }
    }
  }

  // Merged water block: 2 cells wide at (0,1,1)-(1,1,1)
  group.add(createMergedWater(0, 1, 1, 2));

  // Center the world so it rotates nicely around origin
  // group.position.set(-1, -1, -0.5);

  return group;
}

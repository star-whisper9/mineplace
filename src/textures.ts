import * as THREE from 'three';

const loader = new THREE.TextureLoader();
const cache = new Map<string, THREE.Texture>();

const BASE_PATH = `${import.meta.env.BASE_URL}textures/blocks`;

function pixelTexture(path: string): THREE.Texture {
  const cached = cache.get(path);
  if (cached) return cached;

  const tex = loader.load(`${BASE_PATH}/${path}`);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(path, tex);
  return tex;
}

/* ------------------------------------------------------------------ */
/*  Animated spritesheet system                                       */
/* ------------------------------------------------------------------ */

type WaterAnimGroup = {
  frameCount: number;
  fps: number;
  elapsed: number;
  frame: number;
  textures: THREE.Texture[];
};

const stillGroup: WaterAnimGroup = {
  frameCount: 32,
  fps: 10, // 2 ticks/frame at 20 tps
  elapsed: 0,
  frame: 0,
  textures: [],
};

const flowGroup: WaterAnimGroup = {
  frameCount: 32,
  fps: 20, // 1 tick/frame at 20 tps
  elapsed: 0,
  frame: 0,
  textures: [],
};

function waterSpriteSheet(
  path: string,
  frameSize: number,
  totalHeight: number,
  group: WaterAnimGroup,
): THREE.Texture {
  const tex = loader.load(`${BASE_PATH}/${path}`);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  const fc = totalHeight / frameSize;
  tex.repeat.set(1, 1 / fc);
  tex.offset.set(0, 1 - 1 / fc);
  group.textures.push(tex);
  return tex;
}

/** Register a cloned water texture for animation (call after tex.clone()). */
export function registerWaterTexture(
  tex: THREE.Texture,
  type: 'still' | 'flow',
): void {
  (type === 'still' ? stillGroup : flowGroup).textures.push(tex);
}

/** Advance water texture animation. Call once per frame from main loop. */
export function updateAnimatedTextures(dt: number): void {
  for (const g of [stillGroup, flowGroup]) {
    g.elapsed += dt;
    const frameDur = 1 / g.fps;
    if (g.elapsed >= frameDur) {
      g.elapsed -= frameDur;
      g.frame = (g.frame + 1) % g.frameCount;
      const offsetY = 1 - (g.frame + 1) / g.frameCount;
      for (const tex of g.textures) {
        tex.offset.y = offsetY;
      }
    }
  }
}

// --- Block textures ---

export const textures = {
  dirt: () => pixelTexture('dirt.png'),
  grassTop: () => pixelTexture('grass_top.png'),
  grassSide: () => pixelTexture('grass_side_carried.png'),
  farmlandWet: () => pixelTexture('farmland_wet.png'),
  farmlandDry: () => pixelTexture('farmland_dry.png'),
  planksOak: () => pixelTexture('planks_oak.png'),
  logOak: () => pixelTexture('log_oak.png'),
  waterStillGrey: () =>
    waterSpriteSheet('water_still_grey.png', 16, 512, stillGroup),
  waterFlowGrey: () =>
    waterSpriteSheet('water_flow_grey.png', 32, 1024, flowGroup),

  // Wheat: 8 growth stages (0-7)
  wheat: (stage: number) => pixelTexture(`wheat_stage_${stage}.png`),

  // Carrots: 4 growth stages (0-3)
  carrots: (stage: number) => pixelTexture(`carrots_stage_${stage}.png`),

  // Sweet berry bush: 4 growth stages (0-3)
  sweetBerry: (stage: number) =>
    pixelTexture(`sweet_berry_bush_stage${stage}.png`),
} as const;

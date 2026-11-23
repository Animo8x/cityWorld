import * as THREE from 'three';
import { PlayerSkinId } from '../types';

interface SharedMemeAssets {
  mats: {
    yellow: THREE.MeshStandardMaterial;
    bananaTip: THREE.MeshStandardMaterial;
    greenFrog: THREE.MeshStandardMaterial;
    greenBelly: THREE.MeshStandardMaterial;
    white: THREE.MeshStandardMaterial;
    black: THREE.MeshStandardMaterial;
    red: THREE.MeshStandardMaterial;
    orange: THREE.MeshStandardMaterial;
    pink: THREE.MeshStandardMaterial;
    sharkBlue: THREE.MeshStandardMaterial;
    crust: THREE.MeshStandardMaterial;
    crumb: THREE.MeshStandardMaterial;
    butter: THREE.MeshStandardMaterial;
    alienSkin: THREE.MeshStandardMaterial;
    alienGlow: THREE.MeshStandardMaterial;
    skin: THREE.MeshStandardMaterial;
  };
  geos: {
    box: THREE.BoxGeometry;
  };
}

let cachedAssets: SharedMemeAssets | null = null;

function getSharedAssets(): SharedMemeAssets {
  if (cachedAssets) return cachedAssets;
  cachedAssets = {
    mats: {
      yellow: new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.45 }),
      bananaTip: new THREE.MeshStandardMaterial({ color: 0x713f12, roughness: 0.78 }),
      greenFrog: new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.52 }),
      greenBelly: new THREE.MeshStandardMaterial({ color: 0xbef264, roughness: 0.58 }),
      white: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.42 }),
      black: new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.25 }),
      red: new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.48 }),
      orange: new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.45 }),
      pink: new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.5 }),
      sharkBlue: new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.42 }),
      crust: new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.8 }),
      crumb: new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.72 }),
      butter: new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.28, metalness: 0.1 }),
      alienSkin: new THREE.MeshStandardMaterial({ color: 0x84cc16, roughness: 0.36 }),
      alienGlow: new THREE.MeshStandardMaterial({
        color: 0x22d3ee,
        emissive: 0x22d3ee,
        emissiveIntensity: 1.8,
        roughness: 0.2,
      }),
      skin: new THREE.MeshStandardMaterial({ color: 0xe2b18e, roughness: 0.65 }),
    },
    geos: {
      box: new THREE.BoxGeometry(1, 1, 1),
    },
  };
  return cachedAssets;
}

function addPart(
  parent: THREE.Group,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  px: number,
  py: number,
  pz: number,
  sx: number,
  sy: number,
  sz: number,
  rx = 0,
  ry = 0,
  rz = 0
): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(px, py, pz);
  m.scale.set(sx, sy, sz);
  if (rx !== 0 || ry !== 0 || rz !== 0) {
    m.rotation.set(rx, ry, rz);
  }
  parent.add(m);
  return m;
}

/**
 * Builds cached, lightweight 3D meme costume props for both PlayerController & PedestrianSystem.
 * Local coordinates assume:
 *  - `torsoGroup` centered around mid-chest (0, 0, 0)
 *  - `headGroup` centered around head center (0, 0, 0), +Z is forward
 */
export function buildMemeCostumeAttachables(skinId: PlayerSkinId): {
  torsoGroup: THREE.Group;
  headGroup: THREE.Group;
} {
  const { mats, geos } = getSharedAssets();
  const box = geos.box;
  const torsoGroup = new THREE.Group();
  const headGroup = new THREE.Group();

  if (skinId === 'meme_banana_suit') {
    // Bulky curved banana suit shell wrapping torso + bent brown stem & googly eyes on head
    addPart(torsoGroup, box, mats.yellow, 0, 0.02, 0, 0.52, 0.64, 0.34);
    addPart(torsoGroup, box, mats.yellow, 0, -0.32, 0.02, 0.44, 0.22, 0.28, 0.14, 0, 0);
    // Top banana crown + brown stem on head
    addPart(headGroup, box, mats.yellow, 0, 0.04, 0, 0.34, 0.36, 0.32);
    addPart(headGroup, box, mats.yellow, 0, 0.26, -0.04, 0.24, 0.2, 0.22, -0.25, 0, 0);
    addPart(headGroup, box, mats.bananaTip, 0, 0.38, -0.09, 0.12, 0.14, 0.12, -0.35, 0, 0);
    // Derpy googly eyes & huge grin
    addPart(headGroup, box, mats.white, -0.08, 0.06, 0.17, 0.11, 0.11, 0.04);
    addPart(headGroup, box, mats.white, 0.08, 0.08, 0.17, 0.12, 0.12, 0.04);
    addPart(headGroup, box, mats.black, -0.09, 0.04, 0.195, 0.045, 0.045, 0.02);
    addPart(headGroup, box, mats.black, 0.06, 0.1, 0.195, 0.05, 0.05, 0.02);
    addPart(headGroup, box, mats.black, 0, -0.05, 0.17, 0.18, 0.045, 0.03);
  } else if (skinId === 'meme_frog_suit') {
    // Plump lime-belly frog suit + huge bulging meme frog eyeballs & smirk
    addPart(torsoGroup, box, mats.greenFrog, 0, 0, 0, 0.5, 0.58, 0.29);
    addPart(torsoGroup, box, mats.greenBelly, 0, -0.02, 0.14, 0.32, 0.44, 0.05);
    addPart(headGroup, box, mats.greenFrog, 0, 0, 0, 0.33, 0.28, 0.3);
    // Two giant frog eye domes on top of head
    addPart(headGroup, box, mats.greenFrog, -0.11, 0.18, 0.04, 0.14, 0.14, 0.14);
    addPart(headGroup, box, mats.greenFrog, 0.11, 0.18, 0.04, 0.14, 0.14, 0.14);
    addPart(headGroup, box, mats.white, -0.11, 0.18, 0.1, 0.11, 0.1, 0.06);
    addPart(headGroup, box, mats.white, 0.11, 0.18, 0.1, 0.11, 0.1, 0.06);
    addPart(headGroup, box, mats.black, -0.12, 0.18, 0.135, 0.05, 0.05, 0.02);
    addPart(headGroup, box, mats.black, 0.1, 0.18, 0.135, 0.05, 0.05, 0.02);
    // Classic red/pink meme smirk
    addPart(headGroup, box, mats.red, 0, -0.04, 0.155, 0.24, 0.05, 0.03);
  } else if (skinId === 'meme_duck_suit') {
    // Yellow puffy duck suit with orange tail + side flippers + big flat duck bill
    addPart(torsoGroup, box, mats.yellow, 0, 0, 0, 0.52, 0.58, 0.32);
    addPart(torsoGroup, box, mats.yellow, 0, -0.14, -0.21, 0.24, 0.16, 0.16, -0.4, 0, 0);
    addPart(headGroup, box, mats.yellow, 0, 0.02, 0, 0.31, 0.29, 0.3);
    // Flat orange duck bill sticking out forward
    addPart(headGroup, box, mats.orange, 0, -0.03, 0.23, 0.24, 0.075, 0.22);
    addPart(headGroup, box, mats.white, -0.08, 0.07, 0.155, 0.09, 0.09, 0.03);
    addPart(headGroup, box, mats.white, 0.08, 0.07, 0.155, 0.09, 0.09, 0.03);
    addPart(headGroup, box, mats.black, -0.07, 0.07, 0.175, 0.04, 0.04, 0.02);
    addPart(headGroup, box, mats.black, 0.09, 0.07, 0.175, 0.04, 0.04, 0.02);
  } else if (skinId === 'meme_derp_suit') {
    // Giant 2x oversized square derp meme head + asymmetrical googly eyes + buck tooth + tongue!
    addPart(torsoGroup, box, mats.pink, 0, 0, 0, 0.48, 0.56, 0.28);
    addPart(headGroup, box, mats.skin, 0, 0.11, 0, 0.52, 0.5, 0.5);
    addPart(headGroup, box, mats.white, -0.12, 0.17, 0.255, 0.16, 0.16, 0.04);
    addPart(headGroup, box, mats.white, 0.12, 0.12, 0.255, 0.18, 0.18, 0.04);
    // Crossed/opposite derp pupils
    addPart(headGroup, box, mats.black, -0.15, 0.21, 0.28, 0.065, 0.065, 0.02);
    addPart(headGroup, box, mats.black, 0.16, 0.08, 0.28, 0.07, 0.07, 0.02);
    // Big goofy smile, single white buck tooth & pink tongue sticking out
    addPart(headGroup, box, mats.black, 0, -0.02, 0.255, 0.3, 0.08, 0.03);
    addPart(headGroup, box, mats.white, -0.05, 0.0, 0.275, 0.07, 0.05, 0.025);
    addPart(headGroup, box, mats.pink, 0.06, -0.07, 0.28, 0.1, 0.11, 0.06, 0.28, 0, 0);
  } else if (skinId === 'meme_chicken_suit') {
    // Fluffy white chicken suit + red comb + beak + red wattle + side wing stubs
    addPart(torsoGroup, box, mats.white, 0, 0, 0, 0.5, 0.58, 0.32);
    addPart(torsoGroup, box, mats.white, -0.29, 0.05, 0, 0.1, 0.32, 0.24, 0, 0, 0.25);
    addPart(torsoGroup, box, mats.white, 0.29, 0.05, 0, 0.1, 0.32, 0.24, 0, 0, -0.25);
    addPart(headGroup, box, mats.white, 0, 0.02, 0, 0.3, 0.3, 0.3);
    // Red jagged comb on top
    addPart(headGroup, box, mats.red, 0, 0.22, 0.02, 0.07, 0.14, 0.22);
    addPart(headGroup, box, mats.red, 0, 0.28, -0.02, 0.07, 0.09, 0.1);
    // Orange beak + red wattle
    addPart(headGroup, box, mats.orange, 0, -0.01, 0.21, 0.12, 0.09, 0.15);
    addPart(headGroup, box, mats.red, 0, -0.09, 0.17, 0.08, 0.1, 0.06);
    addPart(headGroup, box, mats.black, -0.09, 0.07, 0.155, 0.055, 0.055, 0.02);
    addPart(headGroup, box, mats.black, 0.09, 0.07, 0.155, 0.055, 0.055, 0.02);
  } else if (skinId === 'meme_shark_suit') {
    // Ocean-blue shark suit + dorsal fin on back + shark snout & toothy jaw!
    addPart(torsoGroup, box, mats.sharkBlue, 0, 0, 0, 0.5, 0.58, 0.28);
    addPart(torsoGroup, box, mats.white, 0, -0.02, 0.145, 0.28, 0.44, 0.04);
    // Tall shark dorsal fin on back
    addPart(torsoGroup, box, mats.sharkBlue, 0, 0.08, -0.24, 0.07, 0.44, 0.26, -0.32, 0, 0);
    // Shark hood + protruding nose + jagged teeth
    addPart(headGroup, box, mats.sharkBlue, 0, 0.02, 0, 0.34, 0.32, 0.34);
    addPart(headGroup, box, mats.sharkBlue, 0, 0.08, 0.21, 0.26, 0.13, 0.18);
    addPart(headGroup, box, mats.white, -0.08, -0.01, 0.22, 0.05, 0.06, 0.04);
    addPart(headGroup, box, mats.white, 0, -0.01, 0.22, 0.05, 0.06, 0.04);
    addPart(headGroup, box, mats.white, 0.08, -0.01, 0.22, 0.05, 0.06, 0.04);
    addPart(headGroup, box, mats.black, -0.14, 0.08, 0.16, 0.05, 0.05, 0.04);
    addPart(headGroup, box, mats.black, 0.14, 0.08, 0.16, 0.05, 0.05, 0.04);
  } else if (skinId === 'meme_toast_suit') {
    // Giant crispy slice of toast covering torso & head + melting yellow butter cube!
    addPart(torsoGroup, box, mats.crust, 0, 0.14, 0, 0.64, 0.78, 0.22);
    addPart(torsoGroup, box, mats.crumb, 0, 0.14, 0, 0.54, 0.68, 0.24);
    // Melting butter slab tilted on upper toast chest/forehead
    addPart(headGroup, box, mats.crust, 0, 0.02, 0, 0.48, 0.34, 0.2);
    addPart(headGroup, box, mats.crumb, 0, 0.02, 0, 0.38, 0.26, 0.22);
    addPart(headGroup, box, mats.butter, 0.05, 0.17, 0.04, 0.2, 0.12, 0.22, 0.1, 0.28, -0.12);
    addPart(headGroup, box, mats.black, -0.09, 0.03, 0.115, 0.055, 0.055, 0.02);
    addPart(headGroup, box, mats.black, 0.09, 0.03, 0.115, 0.055, 0.055, 0.02);
    addPart(headGroup, box, mats.red, 0.02, -0.05, 0.12, 0.09, 0.06, 0.03);
  } else if (skinId === 'meme_alien_suit') {
    // Neon lime alien suit + glowing cyan bobble antenna + big black oval eyes
    addPart(torsoGroup, box, mats.alienSkin, 0, 0, 0, 0.44, 0.56, 0.25);
    addPart(torsoGroup, box, mats.alienGlow, 0, 0.08, 0.13, 0.16, 0.16, 0.03);
    addPart(headGroup, box, mats.alienSkin, 0, 0.03, 0, 0.32, 0.32, 0.28);
    // Glowing antenna stalk + orb
    addPart(headGroup, box, mats.alienSkin, 0, 0.28, 0, 0.045, 0.22, 0.045);
    addPart(headGroup, box, mats.alienGlow, 0, 0.41, 0, 0.11, 0.11, 0.11);
    // Giant slanted black alien eyes
    addPart(headGroup, box, mats.black, -0.09, 0.04, 0.145, 0.1, 0.14, 0.03, 0, 0, 0.28);
    addPart(headGroup, box, mats.black, 0.09, 0.04, 0.145, 0.1, 0.14, 0.03, 0, 0, -0.28);
    addPart(headGroup, box, mats.black, 0, -0.07, 0.145, 0.1, 0.03, 0.02);
  }

  return { torsoGroup, headGroup };
}

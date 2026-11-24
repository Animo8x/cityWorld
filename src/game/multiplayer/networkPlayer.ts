import * as THREE from 'three';
import { buildMemeCostumeAttachables } from '../player/memeCostumes';
import { PLAYER_SKINS } from '../player/skinCatalog';
import type { PlayerSkinId, WeaponId } from '../types';
import { SnapshotInterpolator } from './networkInterpolation';
import { PlayerNameplate } from './playerNameSystem';
import type { RemoteAnimState, RemotePlayerState } from './protocol';

interface RemotePlayerVisual {
  id: string;
  root: THREE.Group;
  torsoPivot: THREE.Group;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  heldGunGroup: THREE.Group;
  hairMesh: THREE.Mesh;
  shadesMesh: THREE.Mesh;
  costumeTorsoAnchor: THREE.Group;
  costumeHeadAnchor: THREE.Group;
  memeCostumes: Partial<Record<PlayerSkinId, { torsoGroup: THREE.Group; headGroup: THREE.Group }>>;
  weaponMeshes: Partial<Record<WeaponId, THREE.Group>>;
  jacketMat: THREE.MeshStandardMaterial;
  shirtMat: THREE.MeshStandardMaterial;
  pantsMat: THREE.MeshStandardMaterial;
  shoeMat: THREE.MeshStandardMaterial;
  nameplate: PlayerNameplate;
  interpolator: SnapshotInterpolator;
  state: RemotePlayerState;
  walkPhase: number;
  recoilTimer: number;
  disposables: Array<{ dispose: () => void }>;
}

function createRemotePlayerVisual(initial: RemotePlayerState): RemotePlayerVisual {
  const root = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  const skinMat = new THREE.MeshStandardMaterial({ color: 0xe2b18e, roughness: 0.65 });
  const jacketMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.55, metalness: 0.12 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.7 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.78 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x271912, roughness: 0.85 });
  const shadesMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.15, metalness: 0.8 });
  const gunMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.8 });
  const gripMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.6 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.72 });
  const rpgOliveMat = new THREE.MeshStandardMaterial({ color: 0x365314, roughness: 0.55, metalness: 0.25 });
  const warheadMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.4, metalness: 0.45 });
  disposables.push(
    skinMat,
    jacketMat,
    shirtMat,
    pantsMat,
    shoeMat,
    hairMat,
    shadesMat,
    gunMat,
    gripMat,
    woodMat,
    rpgOliveMat,
    warheadMat
  );

  const torsoPivot = new THREE.Group();
  torsoPivot.position.set(0, 0.88, 0);

  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.56, 0.25), jacketMat);
  chest.position.set(0, 0.28, 0);
  chest.castShadow = true;

  const undershirt = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.45, 0.265), shirtMat);
  undershirt.position.set(0, 0.27, 0.005);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.27, 0.26), skinMat);
  head.position.set(0, 0.72, 0);
  head.castShadow = true;

  const hairMesh = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.11, 0.28), hairMat);
  hairMesh.position.set(0, 0.84, -0.01);

  const shadesMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.05), shadesMat);
  shadesMesh.position.set(0, 0.74, 0.13);

  const costumeTorsoAnchor = new THREE.Group();
  costumeTorsoAnchor.position.set(0, 0.28, 0);
  const costumeHeadAnchor = new THREE.Group();
  costumeHeadAnchor.position.set(0, 0.72, 0);

  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.31, 0.52, 0);
  const lArm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.52, 0.15), jacketMat);
  lArm.position.set(0, -0.22, 0);
  const lHand = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.12, 0.11), skinMat);
  lHand.position.set(0, -0.51, 0);
  leftArmPivot.add(lArm, lHand);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.31, 0.52, 0);
  const rArm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.52, 0.15), jacketMat);
  rArm.position.set(0, -0.22, 0);
  const rHand = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.12, 0.11), skinMat);
  rHand.position.set(0, -0.51, 0);

  const heldGunGroup = new THREE.Group();
  heldGunGroup.position.set(0, -0.52, 0.14);

  const pistolGrp = new THREE.Group();
  pistolGrp.add(
    new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.28), gunMat),
    (() => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.08), gripMat);
      m.position.set(0, -0.08, -0.07);
      return m;
    })()
  );

  const smgGrp = new THREE.Group();
  smgGrp.add(
    (() => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 0.48), gunMat);
      m.position.set(0, 0, 0.08);
      return m;
    })(),
    (() => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.19, 0.07), gripMat);
      m.position.set(0, -0.12, 0.08);
      return m;
    })()
  );

  const shotGrp = new THREE.Group();
  shotGrp.add(
    (() => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 0.68), gunMat);
      m.position.set(0, 0.02, 0.16);
      return m;
    })(),
    (() => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.11, 0.34), woodMat);
      m.position.set(0, -0.02, -0.18);
      return m;
    })()
  );

  const rifleGrp = new THREE.Group();
  rifleGrp.add(
    (() => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.12, 0.72), gunMat);
      m.position.set(0, 0.02, 0.18);
      return m;
    })(),
    (() => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.2, 0.08), gripMat);
      m.position.set(0, -0.12, 0.12);
      m.rotation.x = 0.22;
      return m;
    })()
  );

  const rpgGrp = new THREE.Group();
  rpgGrp.position.set(0.06, 0.16, -0.05);
  const rpgTube = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 1.15, 10), rpgOliveMat);
  rpgTube.rotation.x = Math.PI / 2;
  rpgTube.position.set(0, 0, 0.1);
  const rpgWarhead = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.28, 10), warheadMat);
  rpgWarhead.rotation.x = Math.PI / 2;
  rpgWarhead.position.set(0, 0, 0.76);
  rpgGrp.add(rpgTube, rpgWarhead);

  const weaponMeshes: Partial<Record<WeaponId, THREE.Group>> = {
    pistol: pistolGrp,
    smg: smgGrp,
    shotgun: shotGrp,
    rifle: rifleGrp,
    rpg: rpgGrp,
  };
  heldGunGroup.add(pistolGrp, smgGrp, shotGrp, rifleGrp, rpgGrp);
  rightArmPivot.add(rArm, rHand, heldGunGroup);

  torsoPivot.add(
    chest,
    undershirt,
    head,
    hairMesh,
    shadesMesh,
    costumeTorsoAnchor,
    costumeHeadAnchor,
    leftArmPivot,
    rightArmPivot
  );

  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.12, 0.88, 0);
  const lLeg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.78, 0.2), pantsMat);
  lLeg.position.set(0, -0.4, 0);
  const lShoe = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.11, 0.28), shoeMat);
  lShoe.position.set(0, -0.82, 0.04);
  leftLegPivot.add(lLeg, lShoe);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.12, 0.88, 0);
  const rLeg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.78, 0.2), pantsMat);
  rLeg.position.set(0, -0.4, 0);
  const rShoe = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.11, 0.28), shoeMat);
  rShoe.position.set(0, -0.82, 0.04);
  rightLegPivot.add(rLeg, rShoe);

  // Floating Nameplate rendered strictly over real multiplayer players (never NPCs)
  const nameplate = new PlayerNameplate(initial.name);
  root.add(torsoPivot, leftLegPivot, rightLegPivot, nameplate.sprite);

  const interpolator = new SnapshotInterpolator(95);
  interpolator.reset({
    t: performance.now(),
    x: initial.x,
    y: initial.y,
    z: initial.z,
    heading: initial.heading,
    vx: initial.vx,
    vz: initial.vz,
  });

  const visual: RemotePlayerVisual = {
    id: initial.id,
    root,
    torsoPivot,
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
    heldGunGroup,
    hairMesh,
    shadesMesh,
    costumeTorsoAnchor,
    costumeHeadAnchor,
    memeCostumes: {},
    weaponMeshes,
    jacketMat,
    shirtMat,
    pantsMat,
    shoeMat,
    nameplate,
    interpolator,
    state: { ...initial },
    walkPhase: 0,
    recoilTimer: 0,
    disposables,
  };
  applyRemoteSkin(visual, initial.skinId);
  return visual;
}

function applyRemoteSkin(v: RemotePlayerVisual, skinId: PlayerSkinId): void {
  const skin = PLAYER_SKINS[skinId] ?? PLAYER_SKINS.classic;
  v.jacketMat.color.setHex(skin.jacketColor);
  v.jacketMat.metalness = skin.metalness;
  v.jacketMat.roughness = skin.roughness;
  v.jacketMat.emissive.setHex(skin.emissive ?? 0x000000);
  v.jacketMat.emissiveIntensity = skin.emissiveIntensity ?? 0;
  v.shirtMat.color.setHex(skin.shirtColor);
  v.pantsMat.color.setHex(skin.pantsColor);
  v.shoeMat.color.setHex(skin.shoeColor);

  const isMeme = Boolean(skin.isMeme);
  v.hairMesh.visible = !isMeme;
  v.shadesMesh.visible = !isMeme;

  for (const key of Object.keys(v.memeCostumes) as PlayerSkinId[]) {
    const entry = v.memeCostumes[key];
    if (entry) {
      entry.torsoGroup.visible = key === skinId;
      entry.headGroup.visible = key === skinId;
    }
  }

  if (isMeme && !v.memeCostumes[skinId]) {
    const built = buildMemeCostumeAttachables(skinId);
    v.costumeTorsoAnchor.add(built.torsoGroup);
    v.costumeHeadAnchor.add(built.headGroup);
    v.memeCostumes[skinId] = built;
  }
}

export class NetworkPlayerSystem {
  private scene: THREE.Scene;
  private players = new Map<string, RemotePlayerVisual>();
  private pool: RemotePlayerVisual[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public getRemotePlayers(): RemotePlayerState[] {
    const list: RemotePlayerState[] = [];
    for (const p of this.players.values()) list.push(p.state);
    return list;
  }

  public getPlayerName(playerId: string): string | null {
    return this.players.get(playerId)?.state.name ?? null;
  }

  public upsertPlayer(state: RemotePlayerState, receiveTimeMs: number): void {
    let v = this.players.get(state.id);
    if (!v) {
      const reused = this.pool.pop();
      if (reused) {
        reused.id = state.id;
        reused.state = { ...state };
        reused.nameplate.setName(state.name);
        reused.interpolator.reset({
          t: receiveTimeMs,
          x: state.x,
          y: state.y,
          z: state.z,
          heading: state.heading,
          vx: state.vx,
          vz: state.vz,
        });
        reused.root.visible = true;
        applyRemoteSkin(reused, state.skinId);
        v = reused;
      } else {
        v = createRemotePlayerVisual(state);
      }
      this.players.set(state.id, v);
      this.scene.add(v.root);
      return;
    }

    if (v.state.name !== state.name) {
      v.nameplate.setName(state.name);
    }
    if (v.state.skinId !== state.skinId) {
      applyRemoteSkin(v, state.skinId);
    }
    v.state = { ...state };
    v.interpolator.push({
      t: receiveTimeMs,
      x: state.x,
      y: state.y,
      z: state.z,
      heading: state.heading,
      vx: state.vx,
      vz: state.vz,
    });
  }

  public renamePlayer(playerId: string, name: string, isCustomName: boolean): void {
    const v = this.players.get(playerId);
    if (!v) return;
    v.state.name = name;
    v.state.isCustomName = isCustomName;
    v.nameplate.setName(name);
  }

  public triggerRemoteFire(playerId: string): void {
    const v = this.players.get(playerId);
    if (v) v.recoilTimer = 0.22;
  }

  public removePlayer(playerId: string): void {
    const v = this.players.get(playerId);
    if (!v) return;
    this.players.delete(playerId);
    this.scene.remove(v.root);
    v.root.visible = false;
    if (this.pool.length < 16) {
      this.pool.push(v);
    } else {
      v.nameplate.dispose();
      v.disposables.forEach((d) => d.dispose());
    }
  }

  public clearAll(): void {
    for (const id of Array.from(this.players.keys())) {
      this.removePlayer(id);
    }
  }

  public syncAll(
    states: RemotePlayerState[],
    receiveTimeMs: number,
    localPlayerId: string | null
  ): void {
    const activeIds = new Set<string>();
    for (const s of states) {
      if (s.id === localPlayerId) continue;
      activeIds.add(s.id);
      this.upsertPlayer(s, receiveTimeMs);
    }
    for (const existingId of Array.from(this.players.keys())) {
      if (!activeIds.has(existingId)) {
        this.removePlayer(existingId);
      }
    }
  }

  public update(dt: number, nowMs: number, vehicleWorldLookup: (vehicleId: string, seatIndex: number) => { x: number; y: number; z: number; heading: number } | null): void {
    for (const v of this.players.values()) {
      let x = v.state.x;
      let y = v.state.y;
      let z = v.state.z;
      let heading = v.state.heading;
      const anim: RemoteAnimState = v.state.animState;

      // If seated inside a synced vehicle, lock smoothly onto exact vehicle seat position
      if (v.state.vehicleId) {
        const seatPose = vehicleWorldLookup(v.state.vehicleId, v.state.seatIndex);
        if (seatPose) {
          x = seatPose.x;
          y = seatPose.y;
          z = seatPose.z;
          heading = seatPose.heading;
        }
      } else {
        const sampled = v.interpolator.sample(nowMs);
        if (sampled) {
          x = sampled.x;
          y = sampled.y;
          z = sampled.z;
          heading = sampled.heading;
        }
      }

      v.root.position.set(x, y, z);
      v.root.rotation.set(0, heading, 0);

      // Held weapon visibility
      const showWeapon =
        anim !== 'drive' &&
        anim !== 'passenger' &&
        anim !== 'bike' &&
        anim !== 'swim' &&
        v.state.weaponId !== 'fists';
      v.heldGunGroup.visible = showWeapon;
      if (showWeapon) {
        for (const [wId, grp] of Object.entries(v.weaponMeshes)) {
          if (grp) grp.visible = wId === v.state.weaponId;
        }
      }

      if (v.recoilTimer > 0) v.recoilTimer = Math.max(0, v.recoilTimer - dt);

      // Articulated pose animation
      if (anim === 'drive' || anim === 'passenger') {
        v.torsoPivot.position.y = 0.62;
        v.torsoPivot.rotation.set(0.06, 0, 0);
        v.leftLegPivot.position.y = 0.56;
        v.rightLegPivot.position.y = 0.56;
        v.leftLegPivot.rotation.x = -1.22;
        v.rightLegPivot.rotation.x = -1.22;
        if (anim === 'drive') {
          v.leftArmPivot.rotation.set(-1.02, 0, -0.18);
          v.rightArmPivot.rotation.set(-1.02, 0, 0.18);
        } else {
          v.leftArmPivot.rotation.set(-0.45, 0, 0);
          v.rightArmPivot.rotation.set(-0.45, 0, 0);
        }
      } else if (anim === 'bike') {
        v.torsoPivot.position.y = 0.72;
        v.torsoPivot.rotation.set(0.32, 0, 0);
        v.leftLegPivot.position.y = 0.62;
        v.rightLegPivot.position.y = 0.62;
        v.leftArmPivot.rotation.set(-0.98, 0, -0.14);
        v.rightArmPivot.rotation.set(-0.98, 0, 0.14);
        v.walkPhase += dt * 7;
        v.leftLegPivot.rotation.x = -0.85 + Math.sin(v.walkPhase) * 0.35;
        v.rightLegPivot.rotation.x = -0.85 - Math.sin(v.walkPhase) * 0.35;
      } else if (anim === 'swim') {
        v.torsoPivot.position.y = 0.88;
        v.torsoPivot.rotation.set(1.15, 0, 0);
        v.leftLegPivot.position.y = 0.88;
        v.rightLegPivot.position.y = 0.88;
        v.walkPhase += dt * 7.5;
        v.leftArmPivot.rotation.set(-1.5 + Math.sin(v.walkPhase) * 0.8, 0, 0);
        v.rightArmPivot.rotation.set(-1.5 - Math.sin(v.walkPhase) * 0.8, 0, 0);
        v.leftLegPivot.rotation.x = Math.sin(v.walkPhase) * 0.45;
        v.rightLegPivot.rotation.x = -Math.sin(v.walkPhase) * 0.45;
      } else {
        v.torsoPivot.position.y = 0.88;
        v.torsoPivot.rotation.set(0, 0, 0);
        v.leftLegPivot.position.y = 0.88;
        v.rightLegPivot.position.y = 0.88;
        const speedMag = anim === 'run' ? 12 : anim === 'walk' ? 7 : 0;
        if (speedMag > 0) {
          v.walkPhase += dt * speedMag;
          const swing = anim === 'run' ? 0.72 : 0.46;
          v.leftLegPivot.rotation.x = Math.sin(v.walkPhase) * swing;
          v.rightLegPivot.rotation.x = -Math.sin(v.walkPhase) * swing;
          v.leftArmPivot.rotation.set(-Math.sin(v.walkPhase) * swing * 0.8, 0, 0);
          v.rightArmPivot.rotation.set(
            showWeapon ? -1.35 - v.recoilTimer * 1.1 : Math.sin(v.walkPhase) * swing * 0.8,
            0,
            0
          );
        } else if (anim === 'jump') {
          v.leftLegPivot.rotation.x = -0.35;
          v.rightLegPivot.rotation.x = 0.25;
          v.leftArmPivot.rotation.set(-0.4, 0, -0.2);
          v.rightArmPivot.rotation.set(showWeapon ? -1.35 : -0.4, 0, 0.2);
        } else {
          v.leftLegPivot.rotation.x = 0;
          v.rightLegPivot.rotation.x = 0;
          v.leftArmPivot.rotation.set(0, 0, 0);
          v.rightArmPivot.rotation.set(showWeapon ? -1.32 - v.recoilTimer * 1.1 : 0, 0, 0);
        }
      }
    }
  }

  public dispose(): void {
    this.clearAll();
    for (const v of this.pool) {
      v.nameplate.dispose();
      v.disposables.forEach((d) => d.dispose());
    }
    this.pool = [];
  }
}

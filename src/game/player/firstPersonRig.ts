import * as THREE from 'three';
import { PlayerSkinId, WeaponId } from '../types';
import { PLAYER_SKINS } from './skinCatalog';

export type FirstPersonMode = 'on_foot' | 'car' | 'bike' | 'airplane';

/**
 * Dedicated camera-attached First-Person Viewmodel.
 * Positioned intentionally in the lower edge / lower-right corner of the frame
 * so hands, steering wheel, handlebars, and weapons animate crisply without
 * ever obscuring the center sightline or blocking the windshield view.
 */
export class FirstPersonViewmodel {
  public root: THREE.Group;

  private onFootGroup: THREE.Group;
  private weaponAttach: THREE.Group;
  private fpWeaponMeshes: Partial<Record<WeaponId, THREE.Group>> = {};
  private fistsGroup: THREE.Group;
  private leftFistArm: THREE.Group;
  private rightFistArm: THREE.Group;
  private muzzleFlash: THREE.Mesh;

  private carGroup: THREE.Group;
  private wheelPivot: THREE.Group;

  private airplaneGroup: THREE.Group;
  private yokePivot: THREE.Group;

  private bikeGroup: THREE.Group;
  private bikeBarPivot: THREE.Group;

  private sleeveMat: THREE.MeshStandardMaterial;
  private skinMat: THREE.MeshStandardMaterial;
  private gloveMat: THREE.MeshStandardMaterial;
  private disposables: Array<{ dispose: () => void }> = [];

  private recoil = 0;
  private recoilRot = 0;
  private flashTimer = 0;
  private punchTimer = 0;
  private punchSide = 1;
  private bobPhase = 0;

  constructor() {
    this.root = new THREE.Group();
    this.root.visible = false;

    this.skinMat = new THREE.MeshStandardMaterial({ color: 0xe2b18e, roughness: 0.62 });
    this.sleeveMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.55, metalness: 0.12 });
    this.gloveMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.72 });
    const darkMetal = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.34, metalness: 0.8 });
    const gripMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.65 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xdbeafe, roughness: 0.18, metalness: 0.92 });
    const oliveMat = new THREE.MeshStandardMaterial({ color: 0x365314, roughness: 0.52, metalness: 0.25 });
    const warheadMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.4, metalness: 0.45 });
    const dashMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.72, metalness: 0.15 });
    const accentCyan = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.9,
    });
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xfde047, transparent: true, opacity: 0.92 });

    this.disposables.push(
      this.skinMat,
      this.sleeveMat,
      this.gloveMat,
      darkMetal,
      gripMat,
      woodMat,
      chromeMat,
      oliveMat,
      warheadMat,
      dashMat,
      accentCyan,
      flashMat
    );

    const makeArmGrip = (side: -1 | 1, armLength = 0.24) => {
      const grp = new THREE.Group();
      const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.068, armLength), this.sleeveMat);
      sleeve.position.set(0, -0.02, armLength * 0.52);
      sleeve.rotation.x = 0.16;
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.064, 0.056, 0.078), this.skinMat);
      hand.position.set(0, 0, 0);
      grp.add(sleeve, hand);
      grp.rotation.z = side * -0.14;
      return grp;
    };

    // ---------------------------------------------------------
    // 1. ON-FOOT WEAPON + HANDS VIEWMODEL (Lower-right / low edges)
    // ---------------------------------------------------------
    this.onFootGroup = new THREE.Group();
    this.weaponAttach = new THREE.Group();
    this.weaponAttach.position.set(0.24, -0.23, -0.44);

    // Right holding forearm tucked cleanly below gun grip
    const rForearm = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.072, 0.28), this.sleeveMat);
    rForearm.position.set(0.02, -0.08, 0.16);
    rForearm.rotation.set(0.32, -0.15, 0);
    const rFistHand = new THREE.Mesh(new THREE.BoxGeometry(0.066, 0.068, 0.08), this.skinMat);
    rFistHand.position.set(0.0, -0.045, 0.03);
    this.weaponAttach.add(rForearm, rFistHand);

    // Muzzle flash sprite-like star at tip
    this.muzzleFlash = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), flashMat);
    this.muzzleFlash.visible = false;
    this.weaponAttach.add(this.muzzleFlash);

    // FPS Pistol
    const pistol = new THREE.Group();
    const pSlide = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.062, 0.23), darkMetal);
    pSlide.position.set(0, 0.015, -0.05);
    const pGrip = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.09, 0.058), gripMat);
    pGrip.position.set(0, -0.045, 0.02);
    pGrip.rotation.x = 0.22;
    pistol.add(pSlide, pGrip);

    // FPS SMG
    const smg = new THREE.Group();
    const smgBody = new THREE.Mesh(new THREE.BoxGeometry(0.064, 0.08, 0.36), darkMetal);
    smgBody.position.set(0, 0.02, -0.08);
    const smgBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.16, 8).rotateX(Math.PI / 2), chromeMat);
    smgBarrel.position.set(0, 0.025, -0.32);
    const smgMag = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, 0.052), gripMat);
    smgMag.position.set(0, -0.075, -0.09);
    smgMag.rotation.x = -0.12;
    smg.add(smgBody, smgBarrel, smgMag);

    // FPS Shotgun
    const shotgun = new THREE.Group();
    const shBarrel = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.068, 0.52), darkMetal);
    shBarrel.position.set(0, 0.022, -0.14);
    const shPump = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.065, 0.16), woodMat);
    shPump.position.set(0, -0.018, -0.18);
    const shStock = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.075, 0.22), woodMat);
    shStock.position.set(0, -0.005, 0.16);
    shotgun.add(shBarrel, shPump, shStock);

    // FPS Rifle
    const rifle = new THREE.Group();
    const rfBody = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.082, 0.52), darkMetal);
    rfBody.position.set(0, 0.022, -0.12);
    const rfMag = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.15, 0.06), gripMat);
    rfMag.position.set(0, -0.085, -0.09);
    rfMag.rotation.x = 0.22;
    const rfSight = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.04, 0.12), gripMat);
    rfSight.position.set(0, 0.075, -0.04);
    rifle.add(rfBody, rfMag, rfSight);

    // FPS HX-7 RPG (slung neatly on lower-right shoulder/hip so it never blocks view)
    const rpg = new THREE.Group();
    const rpgTube = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.72, 10).rotateX(Math.PI / 2), oliveMat);
    rpgTube.position.set(0.03, 0.035, -0.12);
    const rpgCone = new THREE.Mesh(new THREE.ConeGeometry(0.076, 0.2, 10).rotateX(-Math.PI / 2), warheadMat);
    rpgCone.position.set(0.03, 0.035, -0.56);
    rpg.add(rpgTube, rpgCone);

    this.fpWeaponMeshes = { pistol, smg, shotgun, rifle, rpg };
    this.weaponAttach.add(pistol, smg, shotgun, rifle, rpg);

    // Low Fists viewmodel (left & right fists tucked very low on corners when melee)
    this.fistsGroup = new THREE.Group();
    this.leftFistArm = makeArmGrip(-1, 0.24);
    this.leftFistArm.position.set(-0.24, -0.31, -0.36);
    this.rightFistArm = makeArmGrip(1, 0.24);
    this.rightFistArm.position.set(0.24, -0.31, -0.36);
    this.fistsGroup.add(this.leftFistArm, this.rightFistArm);

    this.onFootGroup.add(this.weaponAttach, this.fistsGroup);
    this.root.add(this.onFootGroup);

    // ---------------------------------------------------------
    // 2. CAR COCKPIT (Low dashboard + Steering wheel + Transparent Windshield)
    // ---------------------------------------------------------
    this.carGroup = new THREE.Group();
    const windshieldMat = new THREE.MeshStandardMaterial({
      color: 0xa5f3fc,
      roughness: 0.05,
      metalness: 0.25,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const glareMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x090d16,
      roughness: 0.78,
      metalness: 0.15,
    });
    this.disposables.push(windshieldMat, glareMat, pillarMat);

    // Sleek low dashboard cowl near bottom edge of viewport
    const dashCowl = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.14, 0.34), dashMat);
    dashCowl.position.set(0, -0.38, -0.56);
    dashCowl.rotation.x = -0.15;
    const gaugeStrip = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.038, 0.02), accentCyan);
    gaugeStrip.position.set(0, -0.315, -0.45);

    // Transparent Slanted Car Windshield + Faint Glass Reflections + Slim Frame Pillars
    const windshieldGroup = new THREE.Group();
    const glassPane = new THREE.Mesh(new THREE.PlaneGeometry(1.16, 0.62), windshieldMat);
    glassPane.position.set(0, -0.04, -0.62);
    glassPane.rotation.x = -0.46;

    const glassGlareL = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.52), glareMat);
    glassGlareL.position.set(-0.38, -0.04, -0.612);
    glassGlareL.rotation.set(-0.46, 0, -0.14);

    const glassGlareR = new THREE.Mesh(new THREE.PlaneGeometry(0.045, 0.48), glareMat);
    glassGlareR.position.set(-0.27, -0.04, -0.612);
    glassGlareR.rotation.set(-0.46, 0, -0.14);

    const pillarL = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.68, 0.036), pillarMat);
    pillarL.position.set(-0.56, -0.02, -0.6);
    pillarL.rotation.set(-0.46, 0, -0.08);

    const pillarR = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.68, 0.036), pillarMat);
    pillarR.position.set(0.56, -0.02, -0.6);
    pillarR.rotation.set(-0.46, 0, 0.08);

    const headerBar = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.045, 0.05), pillarMat);
    headerBar.position.set(0, 0.255, -0.46);

    const mirrorMount = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.032, 0.025), gripMat);
    mirrorMount.position.set(0, 0.21, -0.45);

    windshieldGroup.add(
      glassPane,
      glassGlareL,
      glassGlareR,
      pillarL,
      pillarR,
      headerBar,
      mirrorMount
    );

    this.wheelPivot = new THREE.Group();
    this.wheelPivot.position.set(0, -0.31, -0.39);
    this.wheelPivot.rotation.x = -0.38;

    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.019, 8, 22), gripMat);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.03, 10).rotateX(Math.PI / 2), dashMat);
    const spokeL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.024, 0.018), chromeMat);
    spokeL.position.x = -0.07;
    const spokeR = spokeL.clone();
    spokeR.position.x = 0.07;
    const spokeB = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.11, 0.018), chromeMat);
    spokeB.position.y = -0.07;

    // Player's two hands gripping 9-and-3 on the steering wheel (arms slope downward off-screen!)
    const carHandL = makeArmGrip(-1, 0.24);
    carHandL.position.set(-0.145, 0, 0.01);
    carHandL.rotation.x = -0.42;
    const carHandR = makeArmGrip(1, 0.24);
    carHandR.position.set(0.145, 0, 0.01);
    carHandR.rotation.x = -0.42;

    this.wheelPivot.add(rim, hub, spokeL, spokeR, spokeB, carHandL, carHandR);
    this.carGroup.add(dashCowl, gaugeStrip, windshieldGroup, this.wheelPivot);
    this.root.add(this.carGroup);

    // ---------------------------------------------------------
    // 3. AIRPLANE COCKPIT (Flight Yoke + Instrument Lip + Canopy Glass)
    // ---------------------------------------------------------
    this.airplaneGroup = new THREE.Group();
    const planeDash = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.13, 0.32), dashMat);
    planeDash.position.set(0, -0.39, -0.56);
    const horizonBar = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.045, 0.02), accentCyan);
    horizonBar.position.set(0, -0.33, -0.43);

    const planeCanopyGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.12, 0.62), windshieldMat);
    planeCanopyGlass.position.set(0, -0.03, -0.61);
    planeCanopyGlass.rotation.x = -0.5;
    const planeGlare = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.5), glareMat);
    planeGlare.position.set(0.32, -0.03, -0.602);
    planeGlare.rotation.set(-0.5, 0, 0.12);
    const planeStrutL = pillarL.clone();
    const planeStrutR = pillarR.clone();
    const planeTopBar = headerBar.clone();

    this.yokePivot = new THREE.Group();
    this.yokePivot.position.set(0, -0.31, -0.4);
    const yokeBar = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.028, 0.028), gripMat);
    const yokeGripL = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.11, 0.032), gripMat);
    yokeGripL.position.set(-0.14, 0.035, 0);
    const yokeGripR = yokeGripL.clone();
    yokeGripR.position.x = 0.14;
    const pHandL = makeArmGrip(-1, 0.24);
    pHandL.position.set(-0.145, 0.03, 0.01);
    pHandL.rotation.x = -0.35;
    const pHandR = makeArmGrip(1, 0.24);
    pHandR.position.set(0.145, 0.03, 0.01);
    pHandR.rotation.x = -0.35;
    this.yokePivot.add(yokeBar, yokeGripL, yokeGripR, pHandL, pHandR);
    this.airplaneGroup.add(
      planeDash,
      horizonBar,
      planeCanopyGlass,
      planeGlare,
      planeStrutL,
      planeStrutR,
      planeTopBar,
      this.yokePivot
    );
    this.root.add(this.airplaneGroup);

    // ---------------------------------------------------------
    // 4. MOTORCYCLE / BICYCLE HANDLEBARS + RIDER HANDS
    // ---------------------------------------------------------
    this.bikeGroup = new THREE.Group();
    this.bikeBarPivot = new THREE.Group();
    this.bikeBarPivot.position.set(0, -0.33, -0.48);

    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.14, 8), chromeMat);
    stem.position.set(0, -0.05, 0);
    const barCross = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.48, 8).rotateZ(Math.PI / 2), chromeMat);
    const gripL = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.11, 8).rotateZ(Math.PI / 2), gripMat);
    gripL.position.set(-0.2, 0, 0);
    const gripR = gripL.clone();
    gripR.position.set(0.2, 0, 0);

    const bikeHandL = makeArmGrip(-1, 0.25);
    bikeHandL.position.set(-0.195, 0.01, 0.01);
    bikeHandL.rotation.x = -0.32;
    const bikeHandR = makeArmGrip(1, 0.25);
    bikeHandR.position.set(0.195, 0.01, 0.01);
    bikeHandR.rotation.x = -0.32;

    this.bikeBarPivot.add(stem, barCross, gripL, gripR, bikeHandL, bikeHandR);
    this.bikeGroup.add(this.bikeBarPivot);
    this.root.add(this.bikeGroup);
  }

  public syncSkin(skinId: PlayerSkinId): void {
    const def = PLAYER_SKINS[skinId];
    if (!def) return;
    this.sleeveMat.color.setHex(def.jacketColor);
    this.sleeveMat.metalness = def.metalness;
    this.sleeveMat.roughness = def.roughness;
    this.sleeveMat.emissive.setHex(def.emissive ?? 0x000000);
    this.sleeveMat.emissiveIntensity = def.emissiveIntensity ?? 0;
  }

  public triggerFire(weaponId: WeaponId): void {
    if (weaponId === 'fists') {
      this.triggerPunch();
      return;
    }
    this.recoil = weaponId === 'rpg' ? 0.13 : weaponId === 'shotgun' ? 0.1 : weaponId === 'smg' ? 0.04 : 0.07;
    this.recoilRot = weaponId === 'rpg' ? 0.18 : weaponId === 'shotgun' ? 0.24 : 0.16;
    this.flashTimer = 0.055;

    const tipZ =
      weaponId === 'pistol'
        ? -0.2
        : weaponId === 'smg'
          ? -0.43
          : weaponId === 'shotgun'
            ? -0.44
            : weaponId === 'rifle'
              ? -0.43
              : -0.66;
    this.muzzleFlash.position.set(weaponId === 'rpg' ? 0.03 : 0, 0.025, tipZ);
    this.muzzleFlash.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    this.muzzleFlash.scale.setScalar(weaponId === 'rpg' ? 1.4 : weaponId === 'shotgun' ? 1.25 : 0.85);
    this.muzzleFlash.visible = true;
  }

  public triggerPunch(): void {
    this.punchTimer = 0.28;
    this.punchSide *= -1;
  }

  public update(
    dt: number,
    state: {
      active: boolean;
      mode: FirstPersonMode;
      weaponId: WeaponId;
      steerAngle: number;
      speed: number;
      isMoving: boolean;
      isSprinting: boolean;
      isSwimming: boolean;
    }
  ): void {
    this.root.visible = state.active;
    if (!state.active) return;

    this.onFootGroup.visible = state.mode === 'on_foot' && !state.isSwimming;
    this.carGroup.visible = state.mode === 'car';
    this.airplaneGroup.visible = state.mode === 'airplane';
    this.bikeGroup.visible = state.mode === 'bike';

    this.recoil = THREE.MathUtils.damp(this.recoil, 0, 18, dt);
    this.recoilRot = THREE.MathUtils.damp(this.recoilRot, 0, 16, dt);
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) this.muzzleFlash.visible = false;
    }
    if (this.punchTimer > 0) {
      this.punchTimer = Math.max(0, this.punchTimer - dt);
    }

    if (state.mode === 'on_foot') {
      const isMelee = state.weaponId === 'fists';
      this.fistsGroup.visible = isMelee;
      this.weaponAttach.visible = !isMelee;

      (Object.keys(this.fpWeaponMeshes) as WeaponId[]).forEach((k) => {
        const m = this.fpWeaponMeshes[k];
        if (m) m.visible = k === state.weaponId;
      });

      if (state.isMoving) {
        this.bobPhase += dt * (state.isSprinting ? 13 : 8.5);
      } else {
        this.bobPhase += dt * 1.8;
      }
      const bobX = state.isMoving ? Math.cos(this.bobPhase) * 0.014 : 0;
      const bobY = state.isMoving ? Math.abs(Math.sin(this.bobPhase)) * 0.015 : Math.sin(this.bobPhase) * 0.004;

      this.weaponAttach.position.set(0.24 + bobX, -0.23 - bobY, -0.44 + this.recoil);
      this.weaponAttach.rotation.set(this.recoilRot, 0, 0);

      // Punch swing keeps fists low-profile & never hides center screen
      const swing = this.punchTimer > 0 ? Math.sin((this.punchTimer / 0.28) * Math.PI) : 0;
      const lAdvance = this.punchSide < 0 ? swing : 0;
      const rAdvance = this.punchSide > 0 ? swing : 0;
      this.leftFistArm.position.set(-0.24 + lAdvance * 0.14, -0.31 + lAdvance * 0.09 - bobY, -0.36 - lAdvance * 0.24);
      this.rightFistArm.position.set(0.24 - rAdvance * 0.14, -0.31 + rAdvance * 0.09 - bobY, -0.36 - rAdvance * 0.24);
    } else if (state.mode === 'car') {
      const vib = Math.sin(performance.now() * 0.035) * Math.min(0.0025, Math.abs(state.speed) * 0.00005);
      // KeyA steer > 0 => steer wheel rotates CCW (+Z rotation)
      this.wheelPivot.rotation.z = state.steerAngle * 1.35;
      this.carGroup.position.y = vib;
    } else if (state.mode === 'airplane') {
      this.yokePivot.rotation.z = state.steerAngle * 0.85;
    } else if (state.mode === 'bike') {
      this.bikeBarPivot.rotation.y = state.steerAngle * 0.72;
      this.bikeBarPivot.rotation.z = state.steerAngle * 0.14;
    }
  }

  public dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}
